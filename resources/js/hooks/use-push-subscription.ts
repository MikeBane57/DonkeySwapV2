import { usePage } from '@inertiajs/react';
import { useCallback, useEffect, useRef, useState } from 'react';

/**
 * Converts a base64url VAPID public key to a Uint8Array for PushManager.subscribe().
 */
function urlBase64ToUint8Array(base64String: string): Uint8Array {
    const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
    const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
    const rawData = atob(base64);
    const output = new Uint8Array(rawData.length);
    for (let i = 0; i < rawData.length; i++) {
        output[i] = rawData.charCodeAt(i);
    }
    return output;
}

function getCsrfToken(): string {
    const name = 'XSRF-TOKEN=';
    const ca = document.cookie.split(';');
    for (let i = 0; i < ca.length; i++) {
        let c = ca[i];
        while (c.startsWith(' ')) c = c.substring(1);
        if (c.indexOf(name) === 0) return decodeURIComponent(c.substring(name.length, c.length));
    }
    return '';
}

/**
 * Registers the service worker and subscribes to push when the user is logged in
 * and vapid_public_key is available. Sends the subscription to the backend.
 */
export function usePushSubscription() {
    const page = usePage();
    const props = page.props as { auth?: { user?: unknown }; vapid_public_key?: string | null };
    const vapidKey = props.vapid_public_key ?? null;
    const isAuth = !!props.auth?.user;
    const [status, setStatus] = useState<'idle' | 'registering' | 'subscribed' | 'unsupported' | 'permission-denied' | 'error'>('idle');
    const attempted = useRef(false);

    const subscribe = useCallback(async () => {
        if (!vapidKey || !isAuth) return;
        if (!('serviceWorker' in navigator) || !('PushManager' in window)) {
            setStatus('unsupported');
            return;
        }
        if (attempted.current && Notification.permission !== 'granted') return;
        attempted.current = true;
        setStatus('registering');
        try {
            const reg = await navigator.serviceWorker.register('/sw.js', { scope: '/' });
            await reg.update();
            if (Notification.permission === 'denied') {
                setStatus('permission-denied');
                attempted.current = false;
                return;
            }
            let permission = Notification.permission;
            if (permission === 'default') {
                permission = await Notification.requestPermission();
            }
            if (permission !== 'granted') {
                setStatus('permission-denied');
                attempted.current = false;
                return;
            }
            const existing = await reg.pushManager.getSubscription();
            const subscription = existing ?? await reg.pushManager.subscribe({
                userVisibleOnly: true,
                applicationServerKey: urlBase64ToUint8Array(vapidKey),
            });
            const payload = subscription.toJSON();
            const body = {
                endpoint: payload.endpoint,
                keys: payload.keys ? { p256dh: payload.keys.p256dh, auth: payload.keys.auth } : undefined,
            };
            if (!body.keys?.p256dh || !body.keys?.auth) {
                setStatus('error');
                attempted.current = false;
                return;
            }
            const res = await fetch('/api/push-subscription', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    Accept: 'application/json',
                    'X-XSRF-TOKEN': getCsrfToken(),
                    'X-Requested-With': 'XMLHttpRequest',
                },
                credentials: 'include',
                body: JSON.stringify(body),
            });
            if (!res.ok) {
                setStatus('error');
                attempted.current = false;
                return;
            }
            setStatus('subscribed');
        } catch {
            setStatus('error');
            attempted.current = false;
        }
    }, [vapidKey, isAuth]);

    useEffect(() => {
        if (isAuth && vapidKey) subscribe();
    }, [isAuth, vapidKey, subscribe]);

    useEffect(() => {
        if (!isAuth || !vapidKey) return;
        const retry = () => {
            attempted.current = false;
            subscribe();
        };
        window.addEventListener('notification-permission-granted', retry);
        return () => window.removeEventListener('notification-permission-granted', retry);
    }, [isAuth, vapidKey, subscribe]);

    return { status, subscribe };
}

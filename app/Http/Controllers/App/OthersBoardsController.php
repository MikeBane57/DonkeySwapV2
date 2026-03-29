<?php

namespace App\Http\Controllers\App;

use App\Http\Controllers\Controller;
use Inertia\Inertia;
use Inertia\Response;

class OthersBoardsController extends Controller
{
    public function index(): Response
    {
        return Inertia::render('app/others-boards');
    }
}

<?php
use Psr\Http\Message\ResponseInterface as Response;
use Psr\Http\Message\ServerRequestInterface as Request;

$app->get('/api/contacts', function (Request $request, Response $response) {
    // Stub for contact sync
    $response->getBody()->write(json_encode(['contacts' => []]));
    return $response->withHeader('Content-Type', 'application/json');
});

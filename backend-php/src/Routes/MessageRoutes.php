<?php
use Psr\Http\Message\ResponseInterface as Response;
use Psr\Http\Message\ServerRequestInterface as Request;
use App\Utils\MongoDB;

$app->get('/api/chats/history', function (Request $request, Response $response) {
    $params = $request->getQueryParams();
    $userId = $params['userId'] ?? null;
    $recipientId = $params['recipientId'] ?? null;

    if (!$userId || !$recipientId) {
        $response->getBody()->write(json_encode(['error' => 'User and Recipient IDs required']));
        return $response->withStatus(400)->withHeader('Content-Type', 'application/json');
    }

    $db = MongoDB::getDatabase();
    $messages = $db->selectCollection('messages');

    $cursor = $messages->find([
        '$or' => [
            ['senderId' => $userId, 'recipientId' => $recipientId],
            ['senderId' => $recipientId, 'recipientId' => $userId]
        ]
    ], ['sort' => ['timestamp' => 1]]);

    $history = iterator_to_array($cursor);

    $response->getBody()->write(json_encode($history));
    return $response->withHeader('Content-Type', 'application/json');
});

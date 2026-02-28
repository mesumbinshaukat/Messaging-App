<?php
use Psr\Http\Message\ResponseInterface as Response;
use Psr\Http\Message\ServerRequestInterface as Request;
use App\Utils\MongoDB;

$app->get('/api/poll', function (Request $request, Response $response) {
    // Note: In real app, this would be protected by JWT middleware
    // For this boilerplate, we'll assume the userId is passed or retrieved
    $params = $request->getQueryParams();
    $userId = $params['userId'] ?? null; // Should come from JWT
    $since = $params['since'] ?? (time() - 60);
    
    if (!$userId) {
        $response->getBody()->write(json_encode(['error' => 'User ID required']));
        return $response->withStatus(400)->withHeader('Content-Type', 'application/json');
    }

    $db = MongoDB::getDatabase();
    $messages = $db->selectCollection('messages');
    
    // Hold connection for up to 25 seconds (Hostinger limit)
    $startTime = time();
    while (time() - $startTime < 25) {
        $cursor = $messages->find([
            'recipientId' => $userId,
            'timestamp' => ['$gt' => new \MongoDB\BSON\UTCDateTime($since * 1000)]
        ]);
        
        $newMessages = iterator_to_array($cursor);
        if (!empty($newMessages)) {
            $response->getBody()->write(json_encode(['messages' => $newMessages]));
            return $response->withHeader('Content-Type', 'application/json');
        }
        
        sleep(2); // Poll every 2 seconds
    }
    
    // No new messages in 25 seconds
    $response->getBody()->write(json_encode(['messages' => []]));
    return $response->withHeader('Content-Type', 'application/json');
});

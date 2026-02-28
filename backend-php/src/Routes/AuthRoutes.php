<?php
use Psr\Http\Message\ResponseInterface as Response;
use Psr\Http\Message\ServerRequestInterface as Request;
use App\Utils\MongoDB;
use Firebase\JWT\JWT;

$app->post('/api/auth/login', function (Request $request, Response $response) {
    $data = $request->getParsedBody();
    $phoneNumber = $data['phoneNumber'] ?? '';
    
    if (empty($phoneNumber)) {
        $response->getBody()->write(json_encode(['error' => 'Phone number required']));
        return $response->withStatus(400)->withHeader('Content-Type', 'application/json');
    }

    $db = MongoDB::getDatabase();
    $users = $db->selectCollection('users');
    $user = $users->findOne(['phoneNumber' => $phoneNumber]);

    if (!$user) {
        // Simple registration for boilerplate
        $result = $users->insertOne([
            'phoneNumber' => $phoneNumber,
            'createdAt' => new \MongoDB\BSON\UTCDateTime(),
            'displayName' => 'User ' . substr($phoneNumber, -4)
        ]);
        $userId = (string)$result->getInsertedId();
    } else {
        $userId = (string)$user->_id;
    }

    $payload = [
        'userId' => $userId,
        'exp' => time() + (7 * 24 * 60 * 60) // 7 days
    ];

    $jwt = JWT::encode($payload, $_ENV['JWT_SECRET'], 'HS256');

    $response->getBody()->write(json_encode([
        'token' => $jwt,
        'user' => [
            'id' => $userId,
            'phoneNumber' => $phoneNumber
        ]
    ]));

    return $response->withHeader('Content-Type', 'application/json');
});

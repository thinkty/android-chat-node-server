'use strict';

/************************************************************************\
|* 여기는 노드 서버를 돌리는 메인 파일입니다                                *|
\************************************************************************/

const ServerConfig = require('./config/serverConfig');
const database = require('./local_modules/database');
const Signals = database.signals;
const ResponseSignals = ServerConfig.signals;
const bodyParser = require('body-parser');
const app = require('express')().use(bodyParser.json());
const http = require('http');
const server = http.createServer(app);
server.listen(ServerConfig.port_number, () => {
    console.log('Node app is running on port ' + ServerConfig.port_number);
});

function timeStamp() {
    return new Date().toString() + ' :: ';
}


/**
 * 모바일 앱에서 연락하는 수단은 socket 을 사용
 */
const io = require('socket.io')(server);
io.on('connect', socket => {
    console.log(timeStamp() + socket.id + ' has connected');

    // user has sent their profile information
    socket.on('profile', (profile) => {
        console.log(timeStamp() + 'User connected >> ' + profile.name + ' / ' + profile.email);
        socket.emit('profileCheck', '');
    });

    // user has been disconnected
    socket.on('disconnect', () => {
        console.log(timeStamp() + socket.id + ' has disconnected');
    });

    // add new user
    socket.on('addUser', async (data) => {
        // Add new user to the database
        let result = await database.handleSignal('ADD_USER', data);
        if (result.error) {
            console.error(result.error);
        } else if (result.response) {
            console.log(timeStamp() + result.response);
        }
    });

    // user has sent a message
    socket.on('sendMessage', async (data) => {
        console.log(timeStamp() + data.sender.email + ' has sent a message to ' + data.receiver.email + ' : ' + data.message);
        // Add message to the chatroom
        let result = await database.handleSignal('UPDATE_CONVERSATION', data);
        if (result.error) {
            console.error(result.error);
        } else if (result.response) {
            console.log(timeStamp() + 'Updated chatroom with ' + data.receiver.email + ' and ' + data.sender.email);
        }
    });

    // user has deleted a chatroom
    socket.on('deleteChatroom', async (data) => {
        console.log(timeStamp() + data.sender.email + ' has deleted a chatroom with ' + data.receiver.email);
        let result = await database.handleSignal('DELETE_CHATROOM', data);
        if (result.error) {
            console.error(result.error);
        } else if (result.response) {
            console.log(result.response);
        }
    });

    // user has created a new chatroom
    socket.on('createChatroom', async (data) => {
        console.log(timeStamp() + data.sender.email + ' has requested to create a new chatroom with ' + data.receiver.email);
        let result = await database.handleSignal('CREATE_CHATROOM', data);
        if (result.error) {
            console.error(result.error);
        } else if (result.response) {
            console.log(timeStamp() + 'Chatroom created between ' + data.sender.email + ' and ' + data.receiver.email + ',  code : ' + result.response);
            // 다음에 사용자가 checkUpdate 를 보내면 task 에 있는 chatRoomList 신호가 전송되어 새로운 채팅방 내용이 전송된다
        }
    })

    // user has sent a signal to check for tasks
    socket.on('checkUpdate', async (profile) => {
        let tasks = await database.getTasks(profile);

        while (tasks.length > 0) {
            let task = tasks.pop();
            console.log('[Task]- ' + profile.email + ' - ' + task.task);
            socket.emit(task.task, task);
        }
    });

    // user has requested conversation history with a certain user
    socket.on('getConversation', async (data) => {
        console.log(timeStamp() + data.sender.email + ' has requested conversation log with ' + data.receiver.email);
        let result = await database.handleSignal('GET_CONVERSATION', data);
        if (result.error) {
            console.error(result.error);
        } else if (result.response) {
            // Array of JSON Objects
            socket.emit('retrieveConversation', result.response.conversation);
        }
    });

    // user has requested every chatroom list
    socket.on('getChatrooms', async (data) => {
        console.log(timeStamp() + data.sender.email + ' has requested chat room list');
        let result = await database.handleSignal('GET_ALL_CHATROOMS', data);
        if (result.error) {
            console.error(result.error);
        } else if (result.response) {
            // Array of JSON Objects
            console.log(timeStamp() + 'Sent ' + result.response.chatrooms.length + ' chatrooms to ' + socket.id);
            socket.emit('chatRoomList', result.response.chatrooms);
        }
    })


});





/**
 * GET 요청을 처리합니다
 * 일반적인 GET 요청의 형식 예시는 samples 폴더 속 json 파일들을 참고하세요
 * 보통 다른 서버에서 연락하는 수단
 */
app.get('/', async (req, res) => {

    const body = req.body;
    let isValid = true;

    // body check
    if (!req.hasOwnProperty(body)) {
        isValid = false;
        res.end('Empty body');
        console.error('Request caught due to empty body')
    }

    // signal check
    if (isValid &&
        (!body.hasOwnProperty('signal') 
        || !Signals.hasOwnProperty(body.signal)
        )) {
        isValid = false;
        res.end('Invalid signal');
        console.error('Request caught in signal check >> ' + body.signal);
    }

    // sender name, email check
    if (isValid &&
        (!body.hasOwnProperty('sender') 
        || !body.sender.hasOwnProperty('name') 
        || !body.sender.hasOwnProperty('email')
        || !body.sender.hasOwnProperty('profileUrl')
        )) {
        isValid = false;
        res.end('Invalid sender format');
        console.error('Request caught in sender name, email, profileUrl check');
    }
    
    // check receiver for some signals
    if (isValid && body.signal !== 'ADD_USER' && body.signal !== 'GET_ALL_CHATROOMS') {
        if (!body.hasOwnProperty('receiver')
            || !body.receiver.hasOwnProperty('name')
            || !body.receiver.hasOwnProperty('email')
            || !body.receiver.hasOwnProperty('profileUrl')
            ) {
                isValid = false;
                res.end('Invalid receiver format');
                console.error('Request caught in receiver check');
        }
    }

    // check message for UPDATE_CONVERSATION signal
    if (isValid && body.signal === 'UPDATE_CONVERSATION' && !body.hasOwnProperty('message')) {
        isValid = false;
        res.end('Invalid message format');
        console.error('Request caught in message check');
    }
    
    // check route (android, ios, server)
    if (isValid && !body.hasOwnProperty('route')) {
        isValid = false;
        res.end('Invalid route format');
        console.error('Request caught in route check');
    }

    // Check complete
    if (isValid) {
        let result = await database.handleSignal(body.signal, body);

        console.log('\n}-- Query result');
        if (result.error) { // error 가 null 이 아닌 경우
            console.error(result.error);
            res.end('Server Error')
        } else if (result.signal == null) { // signal 이 없는 경우 response 만 출력
            console.log(result.response);
            res.end('Success');
        } else { // signal 값을 바탕으로 행동
            
            let reportSignal = result.signal;
            let roomId, user1, user2, sender, receiver, message, user, conversation, chatrooms; 

            switch(reportSignal) {

                // 양쪽 모바일 앱 상에 채팅방 생성
                case ResponseSignals.createRoom:
                    roomId = result.response.room_id; // 채팅방 고유 번호
                    user1 = result.response.user_1; // 이름, 이메일 주소, 프로필 사진 주소 속성이 있다
                    user2 = result.response.user_2;
    
                    //TODO: 저것을 모바일 앱들한테 다시 보내줘야하는데 그게 어떻게 가능할까? 나는 지금 그들의 닉네임, 이메일 주소 밖에 모르는데...
                    break;

                // 한 쪽 모바일 앱에 메세지 전송
                case ResponseSignals.updateMessage:
                    sender = result.response.sender;
                    receiver = result.response.receiver;
                    message = result.response.message;

                    //TODO: 보내기
                    break;

                // 한 쪽 모바일 앱에 대화 내용 전송
                case ResponseSignals.showConversation:
                    user = result.response.user; // 요청 사용자
                    conversation = result.response.conversation; // 대화 내용
    
                    //TODO: 보내기
                    break;

                // 한 쪽 모바일 앱에 현재 사용자의 모든 채팅방과 상대방의 이름, 프로필 사진 주소를 전송
                case ResponseSignals.showAllChatrooms:
                    user = result.response.user; // 요청 사용자
                    chatrooms = result.response.chatrooms; // 채팅방 객체 배열: 각 아이템에는 마지막 메세지, 상대 이름, 상대 프로필 사진 주소
                
                    //TODO: 보내기
                    break;

                default: {
                    console.error('Error: uncaught signal >> ' + reportSignal);
                    break;
                }
            }


            res.end('check');
        }
    }
});
'use strict';

/************************************************************************\
|* 여기는 메인 노드 서버를 테스트 하기 위한 노드 파일 입니다                 *|
\************************************************************************/

const ServerConfig = require('./config/serverConfig');
const io = require('socket.io-client');
const socket = io.connect('http://localhost:' + ServerConfig.port_number);
let isConnected = false;

// 프로필을 전송
const profile = {
    name: '김태윤',
    email: 'thinkty@naver.com',
    profileUrl: null
};

const testPackage = {
    sender : {
        name : "윤선문",
        email : "sunmoon@naver.com",
        profileUrl : null
    },
    receiver: {
        name: "김태윤",
        email: "thinkty@naver.com",
        profileUrl: null
    },
    message: "하이루",
    route : "android"
};

// when disconnected
socket.on('disconnect', () => {
    console.log(`}-- Disconnected`);
    isConnected = false;
});

// when connected
socket.on('connect', (data) => {
    console.log(`}-- Connected`);
    socket.emit('profile', profile);
    isConnected = true;
    console.log(`}-- Profile sent`);
});

// when profile check is complete
socket.on('profileCheck', () => {
    console.log(`}-- Profile checked`);
    
    // sendMessage, deleteChatroom, getAllChatrooms, getAllConversation
    socket.emit('sendMessage', testPackage);

    // loop to check for updates on the user
    (function checkForUpdates() {
        if (isConnected) {
            socket.emit('checkUpdate', profile);
        }
        setTimeout(checkForUpdates, 1000);
    })();
});

// when there is no new update from the server
socket.on('noUpdate', () => {console.log('.');});

// when the task is to create a new chatroom
socket.on('CREATE_CHATROOM', (task) => {
    let opponent = task.opponent;
    console.log(opponent.name + '님과 채팅방이 만들어졌습니다');
});

// when the task is to update message on a chatroom
socket.on('MESSAGE_UPDATE', (task) => {
    let opponent = task.opponent;
    let message = opponent.message;
    console.log(opponent.name + '님이 메세지를 보냈습니다: ' + message);
});

// when the task is to load the entire conversation from the server of a particular room
socket.on('showConversation', (data) => {

    // TODO: 


});

// when the task is to load every chatroom that the user is in
socket.on('showAllChatrooms', (data) => {

});

// when the task is to notify the user that the opponent has left
socket.on('CHATROOM_DELETED', (task) => {
    let opponent = task.opponent;
    console.log(opponent.name + '님이 채팅방을 나갔습니다');
})
'use strict';

/************************************************************************\
|* 여기는 메인 노드 서버를 테스트 하기 위한 노드 파일 입니다                 *|
\************************************************************************/


const ServerConfig = require('./config/serverConfig');
const request = require('request');

let addUser = {
    uri: 'http://localhost:' + ServerConfig.port_number,
    method: 'GET',
    json: {
        "signal" : "ADD_USER",
        "sender" : {
            "name" : "윤선문",
            "email" : "just4ink007@gmail.com",
            "profileUrl" : null
        },
        "route" : "android"
    }
};

let createChatroom = {
    uri: 'http://localhost:' + ServerConfig.port_number,
    method: 'GET',
    json: {
        "signal" : "CREATE_CHATROOM",
        "sender" : {
            "name" : "윤선문",
            "email" : "sunmoon@naver.com",
            "profileUrl" : null
        },
        "receiver" : {
            "name" : "김태윤",
            "email" : "thinkty@naver.com",
            "profileUrl" : null
        },
        "route" : "android"
    }
};

let updateConversation = {
    uri: 'http://localhost:' + ServerConfig.port_number,
    method: 'GET',
    json: {
        "route" : "android",
        "signal" : "UPDATE_CONVERSATION",
        "receiver" : {
            "name" : "김태윤",
            "email" : "thinkty@naver.com",
            "profileUrl" : null
        },
        "sender" : {
            "name" : "윤선문",
            "email" : "just4ink007@gmail.com",
            "profileUrl" : null
        },
        "message" : "뒤진다"
    }
}

let getAllChatrooms = {
    uri: 'http://localhost:' + ServerConfig.port_number,
    method: 'GET',
    json: {
        "signal" : "GET_ALL_CHATROOMS",
        "sender" : {
            "name" : "김태윤",
            "email" : "thinkty@naver.com",
            "profileUrl" : null
        },
        "route" : "android"
    }
}

let getAllConversation = {
    uri: 'http://localhost:' + ServerConfig.port_number,
    method: 'GET',
    json: {
        "route" : "android",
        "signal" : "GET_CONVERSATION",
        "sender" : {
            "name" : "김태윤",
            "email" : "thinkty@naver.com",
            "profileUrl" : null
        },
        "receiver" : {
            "name" : "윤선문",
            "email" : "just4ink007@gmail.com",
            "profileUrl" : null
        }
    }
}

let removeChatroom = {
    uri: 'http://localhost:' + ServerConfig.port_number,
    method: 'GET',
    json: {
        "route" : "android",
        "signal" : "DELETE_CHATROOM",
        "sender" : {
            "name" : "김태윤",
            "email" : "thinkty@naver.com",
            "profileUrl" : null
        },
        "receiver" : {
            "name" : "윤선문",
            "email" : "just4ink007@gmail.com",
            "profileUrl" : null
        }
    }
};

(function testRequestToLocalServer() {
    const format = createChatroom;
    console.log('===========================');
    request(format, (error, response, body) => {
        if (error) {
            console.error(error);
        } else {
            if (response.body.hasOwnProperty('error')) {
                console.error(response.body.error);
            } else {
                console.log(response.body);
            }
        }
    });

})();
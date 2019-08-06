'use strict';

/************************************************************************\
|* 여기는 서버가 데이터베이스와 통신하기 위한 함수들을 저장해 놓은 곳 입니다  *|
\************************************************************************/

const DatabaseConfig = require('../config/databaseConfig');
const DatabaseUsers = DatabaseConfig.users;
const DatabaseChatrooms = DatabaseConfig.chatrooms;
const DatabaseUrl = DatabaseConfig.db_address;
const DatabaseName = DatabaseConfig.db_name;
const ResponseSignal = require('../config/serverConfig').signals;
const IdLength = DatabaseConfig.room_id_length;
const MongoClient = require('mongodb').MongoClient;



/**
 * DB 에 사용자의 존재 유무를 확인합니다
 * 사용자가 존재할 경우 true 를 줍니다
 * 
 * @param {*} userEmail 
 */
async function checkUser(userEmail) {
    const client = await MongoClient.connect(DatabaseUrl, {useNewUrlParser: true})
    .catch(error => {console.error(error);});
    const db = client.db(DatabaseName);
    const collection = db.collection(DatabaseUsers);
    const result = await collection.findOne({email: userEmail})
    .catch(error => {console.error(error);});
    client.close();
    
    // null is returned if nothing is found (userExists)
    if (result != null) {
        return Promise.resolve(true);
    }
    return Promise.resolve(false);
}




/**
 * DB 에 채팅방을 추가합니다
 * 
 * @param {*} body
 */
async function createChatroom(body) {

    let report = {
        error: null,
        signal: null,
        response: {}
    };

    // if sender and receiver is the same person, ignore the request
    if (body.sender.email == body.receiver.email) {
        report.error = 'Error: User tried to talk to him/herself';
        return Promise.resolve(report);
    }

    // getting connection
    const client = await MongoClient.connect(DatabaseUrl, {useNewUrlParser: true})
    .catch(error => {console.error(error)});

    // get the list of chatroom numbers
    const db = client.db(DatabaseName);
    let collection = db.collection(DatabaseChatrooms);
    let temp = await collection.find().toArray();
    let chatRoomCodes = [];
    let chatRoomEmails = [];
    temp.forEach(item => {
        chatRoomCodes.push(item.room_id);
        chatRoomEmails.push(item.email);
    });

    // generate email code in lexicographical order
    let emailCode = (body.sender.email > body.receiver.email) ? (body.receiver.email + '&' + body.sender.email) : (body.sender.email + '&' + body.receiver.email);

    // check for duplicates
    if (chatRoomEmails.includes(emailCode)) {
        report.error = 'Error: Chatroom already exists!';
        return Promise.resolve(report);
    }

    // generate a random 8 digit that is not in the chatroomCodes list (00000000 ~ 99999999)
    let chatroomCode = generateId(IdLength);
    // check for duplicates
    while (chatRoomCodes.includes(chatroomCode)) {
        chatroomCode = generateId(IdLength);
    }

    // add the new chat room to both user's chatroom list
    collection = db.collection(DatabaseUsers);
    let receiver = await collection.findOne({email: {$eq: body.receiver.email}})
    .catch(error => {console.error(error);});
    if (receiver == null) {
        report.error = 'Error: Receiver does not exist on the database';
        return Promise.resolve(report);
    }
    receiver.chatrooms.push(chatroomCode);

    // add the create_chatroom task to the tasks list
    let taskFormat = {
        task : 'newChatRoomCreated'
    };
    receiver.tasks.push(taskFormat);
    collection.updateOne({email: {$eq: body.receiver.email}}, {$set: receiver})
    .catch(error => {console.error(error);});

    // add the new chat room code to the sender's chatroom list
    collection = db.collection(DatabaseUsers);
    let sender = await collection.findOne({email: {$eq: body.sender.email}})
    .catch(error => {console.error(error);});
    if (sender == null) {
        report.error = 'Error: Sender does not exist on the database';
        return Promise.resolve(report);
    }
    sender.chatrooms.push(chatroomCode);

    // update the chatrooms list on the database
    collection.updateOne({email: {$eq: body.sender.email}}, {$set: sender})
    .catch(error => {console.error(error);});

    // add the new chat room to the database
    collection = db.collection(DatabaseChatrooms);
    collection.insertOne({room_id: chatroomCode, email: emailCode})
    .catch(error => {console.error(error);});

    // create new collection with the following chatroomcode
    await db.createCollection(chatroomCode)
    .catch(error => {console.error(error);});
    client.close();

    // Add system message to the chatroom
    let message = {
        sender: "system",
        sender_name: "system",
        receiver: "system",
        receiver_name: "system",
        time: new Date().getTime().toString(),
        message: "채팅방이 생성되었습니다"
    };
    collection = db.collection(chatroomCode);
    await collection.insertOne(message)
    .catch(error => {console.error(error);});

    report.signal = ResponseSignal.createRoom;
    report.response = chatroomCode;
    return Promise.resolve(report);
}
function generateId(limit) {
    // get random number in the limit
    let code = Math.floor(Math.random() * Math.pow(10, limit)).toString();
    // padding
    if (code.length != limit) {
        return ((limit - code.length) * '0') + code;
    }
    return code;
}



/**
 * DB에 사용자를 추가합니다. 추가하기 전에 중복되는 사용자가 있다면 추가를 취소합니다
 * 
 * @param {*} body
 */
async function addUser(body) {

    let report = {
        error: null,
        signal: null,
        response: {}
    };

    // check if the user already exists
    if (await checkUser(body.sender.email)) {
        report.response = 'User already exists';
        return Promise.resolve(report);
    }

    // Initialize chatrooms
    body.sender.chatrooms = [];

    // Initialize tasks
    body.sender.tasks = [];

    // add user
    const client = await MongoClient.connect(DatabaseUrl, {useNewUrlParser: true})
    .catch(error => {console.error(error);});
    const collection = client.db(DatabaseName).collection(DatabaseUsers);
    await collection.insertOne(body.sender)
    .catch(error => {console.error(error);});
    client.close();

    report.response = 'Added email: ' + body.sender.email;
    return Promise.resolve(report);
}




/**
 * DB에서 사용자와 상대방 간의 대화 내용을 불러옵니다.
 * 
 * @param {*} body
 */
async function getConversation(body) {

    let report = {
        error: null,
        signal: null,
        response: {}
    };

    // Check if both users exist  ----------------->  시간이 너무 오래 걸릴 경우 이 부분은 빼도 됩니다
    if (await !checkUser(body.sender.email) || await !checkUser(body.receiver.email)) {
        report.error = 'ERROR: user does not exist'
        return Promise.resolve(report);
    }

    const client = await MongoClient.connect(DatabaseUrl, {useNewUrlParser: true})
    .catch(error => {console.error(error);});

    // get the email code from both users
    let emailCode = (body.sender.email > body.receiver.email) ? (body.receiver.email + '&' + body.sender.email) : (body.sender.email + '&' + body.receiver.email);

    // find the chatroom id with the following email code
    let collection = client.db(DatabaseName).collection(DatabaseChatrooms);
    let result = await collection.findOne({email: {$eq: emailCode}})
    .catch(error => {console.error(error);});
    
    // if result is null it is a fatal error as the chatroom does not exist
    if (result == null) {
        report.error = 'ERROR: chatroom does not exist: email code: ' + emailCode;
        return Promise.resolve(report);
    }
    
    // get all the documents from the following chatroom
    collection = client.db(DatabaseName).collection(result.room_id);
    let conversation = await collection.find().toArray();
    client.close();

    // make report
    report.signal = ResponseSignal.showConversation;
    report.response.user = body.sender;
    report.response.conversation = conversation;
    return Promise.resolve(report);
}



/**
 * 사용자와 해당 채팅방에 있는 상대와 같이 있는 채팅방을 사용자의 채티방 목록에서 삭제합니다
 * 
 * @param {*} body 
 */
async function markChatroomAsDeleted(body) {

    let report = {
        error: null,
        signal: null,
        response: {}
    };

    const client = await MongoClient.connect(DatabaseUrl, {useNewUrlParser: true})
    .catch(error => {console.error(error);});

    // find the room_id of the chatroom with the opponent
    let collection = client.db(DatabaseName).collection(DatabaseChatrooms);

    // get the email code from both users
    let emailCode = (body.sender.email > body.receiver.email) ? (body.receiver.email + '&' + body.sender.email) : (body.sender.email + '&' + body.receiver.email);
    const result = await collection.findOne({email: {$eq: emailCode}})
    .catch(error => {console.error(error);});
    
    // update user's chatroom array
    collection = client.db(DatabaseName).collection(DatabaseUsers);
    let userProfile = await collection.findOne({email: {$eq: body.sender.email}})
    .catch(error => {console.error(error);});
    let index = userProfile.chatrooms.indexOf(result.room_id);
    userProfile.chatrooms.splice(index, 1);
    
    // update it to the database
    collection.updateOne({email: {$eq: body.sender.email}}, {$set: userProfile})
    .catch(error => {console.error(error);});

    // add 'opponent_left' task to the opponent's tasks
    let opponent = await collection.findOne({email: {$eq: body.receiver.email}})
    .catch(error => {console.error(error);});
    opponent.tasks.push({task: 'CHATROOM_DELETED', opponent: body.sender});
    collection.updateOne({email: {$eq: body.receiver.email}}, {$set: opponent})
    .catch(error => console.error(error));

    client.close();
    report.response = 'Deleted chatroom >> emailCode: ' + emailCode + ' / room_id: ' + result.room_id;
    return Promise.resolve(report);
}



/**
 * 현재 사용자가 들어있는 채팅방을 모두 보여줍니다
 * 자세하게는 마지막 메시지, 상대방 이름, 상대방 프로필 사진을 가져옵니다
 * 
 * @param {*} body
 */
async function getAllChatrooms(body) {

    let report = {
        error: null,
        signal: null,
        response: {}
    };

    const client = await MongoClient.connect(DatabaseUrl, {useNewUrlParser: true})
    .catch(error => {console.error(error);});

    // get all the chatroom ids under the user's profile
    let collection = client.db(DatabaseName).collection(DatabaseUsers);
    let sender = await collection.findOne({email: {$eq: body.sender.email}})
    .catch(error => {console.error(error);});
    let userChatrooms = sender.chatrooms;

    let allChatroomList = [];
    // check every chatroom to get the last message and opponent's email
    for (let i = 0; i < userChatrooms.length; i++) {
        const roomId = userChatrooms[i];
        let item = {};
        collection = client.db(DatabaseName).collection(roomId);
        // 시스템 메시지를 제외한 가장 최근 메시지를 찾기
        let result = await collection.find({sender: {$ne: "system"}}).sort({_id: -1}).limit(1).toArray();
        item.lastMessage = result[0].message;
        item.lastTime = result[0].time;
        // get oppoenent's email
        item.opponentEmail = result[0].sender;
        if (result[0].sender == body.sender.email) {
            item.opponentEmail = result[0].receiver;
        }
        allChatroomList.push(item);
    }

    // get opponent's name and profileUrl
    for (let i = 0; i < allChatroomList.length; i++) {
        const roomID = userChatrooms[i];
        let item = allChatroomList[i];


        // 채팅방 room_id 로 상대방 이름과 프로필 주소 찾기







        collection = client.db(DatabaseName).collection(DatabaseUsers);
        let opponentProfile = await collection.findOne({email: {$eq: item.opponentEmail}})
        .catch(error => {console.error(error);});
        if (opponentProfile == null) {
            report.error = 'ERROR: could not find user with the following email address: ' + item.opponentEmail;
        } else {
            item.opponentName = opponentProfile.name;
            item.opponentUrl = opponentProfile.profileUrl;
        }
    }
    client.close();

    // make report
    report.signal = ResponseSignal.showAllChatrooms;
    report.response.user = body.sender;
    report.response.chatrooms = allChatroomList;
    return Promise.resolve(report);
}



/**
 * DB 에서 sender 와 receiver 둘 다 있는 방을 찾아 대화 내용을 업데이트 합니다
 * 
 * @param {*} body 
 */
async function updateConversation(body) {

    let report = {
        error: null,
        signal: null,
        response: {}
    };

    const client = await MongoClient.connect(DatabaseUrl, {useNewUrlParser: true})
    .catch(error => {console.error(error);});

    // get email code
    let emailCode = (body.sender.email > body.receiver.email) ? (body.receiver.email + '&' + body.sender.email) : (body.sender.email + '&' + body.receiver.email);

    // find the chatroom id with the following email code
    let collection = client.db(DatabaseName).collection(DatabaseChatrooms);
    let result = await collection.findOne({email: {$eq: emailCode}})
    .catch(error => {console.error(error);});

    // if result is null it is a fatal error as the chatroom does not exist
    if (result == null) {
        report.error = 'ERROR: chatroom does not exist: email code: ' + emailCode;
        return Promise.resolve(report);
    }

    // get all the documents from the following chatroom
    collection = client.db(DatabaseName).collection(result.room_id);
    // update the conversation
    let message = {
        sender: body.sender.email,
        sender_name: body.sender.name,
        receiver: body.receiver.email,
        receiver_name: body.receiver.name,
        time: body.time,
        message: body.message
    };
    await collection.insertOne(message)
    .catch(error => {console.error(error);});

    // get other user and check if the room_id is visible in the other user's chatrooms array
    collection = client.db(DatabaseName).collection(DatabaseUsers);
    let opponent = await collection.findOne({email: {$eq: body.receiver.email}})
    .catch(error => {console.error(error);});

    // the receiver has deleted the chatroom
    if (!opponent.chatrooms.includes(result.room_id)) {
        report.response = 'Opponent has left the chatroom';
    } else {
        // let the opponent be notified by modifying the opponent's tasks field
        let tempFormat = {
            sender_name : body.sender.name,
            sender : body.sender.email,
            profileUrl : body.sender.profileUrl,
            message : body.message,
            time : body.time,
            task : 'newMessage'
        };

        opponent.tasks.push(tempFormat);
        collection.updateOne({email: {$eq: body.receiver.email}}, {$set: opponent})
        .catch(error => console.error(error));
    
        report.signal = ResponseSignal.updateMessage;
        report.response.sender = body.sender;
        report.response.receiver = body.receiver;
        report.response.message = body.message;
    }
    client.close();

    return Promise.resolve(report);
}




const SIGNALS = {
    'CREATE_CHATROOM' : createChatroom,
    'ADD_USER' : addUser,
    'GET_CONVERSATION' : getConversation,
    'DELETE_CHATROOM' : markChatroomAsDeleted,
    'GET_ALL_CHATROOMS' : getAllChatrooms,
    'UPDATE_CONVERSATION' : updateConversation,
}


/**
 * index.js 에서 DB 에 필요한 작업을 요청하는 함수
 * 
 * @param {*} signal  실행할 행동을 알리는 신호 
 * @param {*} body    sender 와 receiver 정보가 담긴 객체
 */ 
async function handleSignal(signal, body) {

    // Execute the signal
    let result = null;
    await SIGNALS[signal](body)
    .then(dbResult => {
        result = dbResult;
    });
    
    return Promise.resolve(result);
}


/**
 * 데이터베이스에서 사용자의 해야할 항목이 담겨있는 배열을 가져옵니다
 * 
 * @param {*} profile
 */
async function getTasks(profile) {

    // get tasks array
    const client = await MongoClient.connect(DatabaseUrl, {useNewUrlParser: true})
    .catch(error => console.error(error));
    let collection = client.db(DatabaseName).collection(DatabaseUsers);
    let user = await collection.findOne({email: {$eq: profile.email}})
    .catch(error => {console.error(error);});

    if (user == null) {
        console.error('Error: cannot find user with the email : ' + profile.email);
    }

    let tasks = user.tasks;

    // update the database with an empty array
    user.tasks = [];
    await collection.updateOne({email: {$eq: profile.email}}, {$set: user})
    .catch(error => console.error(error));

    client.close();
    return Promise.resolve(tasks);
}


module.exports.handleSignal = handleSignal;
module.exports.signals = SIGNALS;
module.exports.getTasks = getTasks;
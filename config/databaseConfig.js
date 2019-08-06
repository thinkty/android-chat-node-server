'use strict';

const DATABASE_ADDRESS = `mongodb://localhost:27017`;
const DATABASE_NAME = `chemi_testing`;
const DATABASE_USER_COLLECTION = `users`;
const DATABASE_CHATROOM_COLLECTION = `chatrooms`;
const DATABASE_CHATROOM_ID_LENGTH = 8;

module.exports = {
    'db_address' : DATABASE_ADDRESS,
    'db_name' : DATABASE_NAME,
    'users' : DATABASE_USER_COLLECTION,
    'chatrooms' : DATABASE_CHATROOM_COLLECTION,
    'room_id_length' : DATABASE_CHATROOM_ID_LENGTH,
};
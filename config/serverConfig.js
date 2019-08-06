'use strict';

const PORT_NUMBER = 9000;
const responseSignals = {
    createRoom: 2000,
    updateMessage: 2001,
    showConversation: 2002,
    showAllChatrooms: 2003,

}


module.exports = {
    'port_number' : PORT_NUMBER,
    'signals' : responseSignals,
}
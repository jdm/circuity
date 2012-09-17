function Channel(name) {
  this.name = name;
}

Channel.prototype = {
  name: "",
  users: [], // {name, mode}
  log: [],   // {sender, message}
  topic: "",
  lastSeen: 0,
  
  addUser: function(nick) {
    var mode = "";
    if (["@+%"].indexOf(nick[0]) != -1) {
      mode = nick[0];
      nick = nick.substring(1);
    }
    this.users.push({name: nick, mode: mode});
    this.users.sort(function(a, b) {
                      return a.name > b.name ? 1 :
                             a.name == b.name ? 0 : -1; });
    UI.refresh(this);
  },
  
  removeUser: function(name) {
    for (var i = 0; o < this.users.length; i++) {
      if (this.users[i].name == name) {
        this.users.splice(i, 1);
        UI.refresh(this);
        break;        
      }      
    }
  },

  logMessage: function(sender, message) {
    var idx = this.log.push({sender: sender, message: message});
    UI.refresh(this, this.log[idx - 1]);
  }
};

function IRConnection(host, port, channels, nick) {
  this.host = host;
  this.port = port;
  this.conn = navigator.mozTCPSocket.open(host, port);
  this.nick = nick;
  this.desired_channels = channels;
  this.conn.onopen = this._onopen.bind(this);
  this.conn.onclose = this._onclose.bind(this);
  this.conn.ondata = this._ondata.bind(this);
  this.conn.onerror = this._onerror.bind(this);
  
  this.channels = [];
}

IRConnection.prototype = {
  _onopen: function(ev) {
    this._send("NICK " + this.nick);
    this._send("USER " + this.nick + " 0 0 :CIRCuit user");
  },
  
  _ondata: function(ev) {
    var data = ev.data;
    //console.log(data);
    var lines = data.split(/\r\n/g);
    for (var i = 0; i < lines.length; i++) {
      try {
      
      console.log(lines[i]);
      var components = lines[i].split(/\s+/g);
      if (components[0][0] == ':') {
        this._recvMessage(components[0].substring(1), components.slice(1));
      } else if (components[0] == "PING") {
        this._send("PONG " + components[1]);
      }

      } catch (x) {
        console.error(x);
      }
    }
  },
  
  _onerror: function(ev) {
    console.error(ev.data);
  },

  _onclose: function(ev) {
  },  

  _send: function(data) {
    console.log("sending |" + data + "|");
    this.conn.send(data + "\r\n");
  },
  
  sendMessage: function(target, message) {
    this._send("PRIVMSG " + target + " :" + message);
    appendMessage(this.nick, message);
  },
  
  _recvMessage: function(from, rest) {
    var num = parseInt(rest[0]);
    if (!isNaN(num)) {
      if (num == 1) {
        for (var i = 0; i < this.desired_channels.length; i++)
          this._send("JOIN " + this.desired_channels[i]);
      
      } else if (num == 353) {
        var chan = this._getChan(rest[3]);
        var names = rest.slice(4);
        names[0] = names[0].substring(1);
        for (var i = 0; i < names.length; i++) {
          chan.addUser(names[i]);          
        }
      }

    } else if (rest[0] == "PRIVMSG") {
      var sender = from.split('!')[0];
      this._getChan(rest[1]).logMessage(sender, rest.slice(2).join(' ').substring(1));

    } else if (rest[0] == "JOIN") {
      var chan = rest[1].substring(1);
      var nick = from.split('!')[0];
      if (nick == this.nick) {
        var idx = this.channels.push(new Channel(chan));
        UI.makeActive(idx - 1);
      } else {
        this._getChan(chan).addUser(nick);        
      }

    } else if (res[0] == "PART" || res[0] == "QUIT") {
      var nick = from.split('!')[0];
      var chan = rest[1].substring(1);
      this._getChan(chan).removeUser(nick);

    }
  },
  
  _getChan: function(name) {
    for (var i = 0; i < this.channels.length; i++) {
      if (this.channels[i].name == name)
        return this.channels[i];
    }
    return null;
  }
};

var UI = {
  connections: [],
  currentConn: 0,
  currentChan: 0,
  
  getCurrentChan: function() {
    return this.connections[this.currentConn].channels[this.currentChan];
  },

  makeConnectionActive: function(idx) {
    this.currentConn = idx;
    this.makeActive(0);
  },

  makeActive: function(idx) {
    this.currentChan = idx;
    var chan = this.getCurrentChan();
    $('#topic')[0].textContent = chan.name + " - " + chan.topic;
    $('#log')[0].innerHTML = '';
    for (var i = 0; i < chan.log.length; i++) {
      appendMessage(chan.log[i].sender, chan.log[i].message);
    }
    this._refreshUsers(chan);
  },
  
  refresh: function(channel, newMessage) {
    if (channel != this.getCurrentChan())
      return;
    
    if (newMessage) {
      appendMessage(newMessage.sender, newMessage.message);
      return;
    }
    
    this._refreshUsers(channel);
  },
  
  _refreshUsers: function(channel) {
    var users = $('#userlist .user');
    for (var i = 0; i < users.length; i++) {
      users[i].parentNode.removeChild(users[i]);
    }
    for (var i = 0; i < channel.users.length; i++) {
      appendUser(channel.users[i].mode, channel.users[i].name);
    }
  }
};

function appendMessage(source, message) {
  var msg = document.createElement('div');
  msg.setAttribute('class', "message");
  var sender = document.createElement('span');
  sender.setAttribute('class', "sender");
  sender.textContent = source;
  var text = document.createElement('span');
  text.setAttribute('class', 'text');
  text.textContent = message;

  msg.appendChild(document.createTextNode('<'));
  msg.appendChild(sender);
  msg.appendChild(document.createTextNode('> '));
  msg.appendChild(text);

  $('#log')[0].appendChild(msg);
}

function appendUser(mode, name) {
  var user = document.createElement('div');
  user.setAttribute('class', 'user');
  user.textContent = mode + name;
  $('#userlist')[0].appendChild(user);
}

function chatinput(ev) {
  if (ev.which != 13)
    return;

  conn.sendMessage(conn.channels[conn.channels.length - 1].name, ev.target.value);
  ev.target.value = '';
}

var conn;
function connect(ev) {
  ev.preventDefault();
  
  var host = document.getElementById('network').value;
  var port = document.getElementById('port').value;
  var channels = document.getElementById('channel').value.split(',');
  var user = document.getElementById('name').value;
  conn = new IRConnection(host, port, channels.map(function(a) { return a.trim(); }), user);
  UI.connections.push(conn);

  var conf = $('#config')[0];
  conf.parentNode.removeChild(conf);
  
  $('#chatbox')[0].style.display = 'block';
}

//window.onerror = log;

/*function log(msg) {
  var text = document.createTextNode(msg);
  var msgs = document.getElementById('messages');
  msgs.appendChild(text);
  msgs.appendChild(document.createElement('br'));
}*/

/*var request = navigator.mozApps.getInstalled(); 
request.onerror = function(e) {
  console.log("Error calling getInstalled: " + request.error.name);
};
request.onsuccess = function(e) {
  console.log("Success, number of apps: " + request.result.length);
  if (request.result.length == 0) {
    var req = navigator.mozApps.install('http://localhost:8000/manifest.webapp');
    var record;
    req.onsuccess = function() {
      record = this.result;
      console.log("Installed");
    };
    req.onerror = function() {
      console.log("Install failed: " + this.error.name);
    };
  }
  var appsRecord = request.result;
};*/

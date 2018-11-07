const qr = require('qr-image');
const express = require('express');
const app = express();
const http = require('http').Server(app)
const io = require('socket.io')(http)
const ethUtil = require('ethereumjs-util');

const conTable = {};

app.set('views', './views')
app.set('view engine', 'pug');

const DEFAUTL_PUBLIC_ADDR = '0x653b9a344accbb759462a661a73f90af28b73565'
const messageStore = {}


app.get('/', function (req, res) {
  const { account } = req.query;
  const locals = {}

  const data = `0x${new Date().getTime()}`
  messageStore[account || DEFAUTL_PUBLIC_ADDR] = data
  const message = JSON.stringify({
    type: 'TwoFactorAuthentication',
    data: data
  })
  // console.log('產生訊息 => ' + data)

  locals.qrPath = `/qrcode?qrurl=${message}`
  locals.account = `${account || DEFAUTL_PUBLIC_ADDR}`
  locals.result = ''

  res.render('index', locals)
});


app.get('/verify', function (req, res) {
  const { signature, from } = req.query;
  let Verified = 'fail'
  
  if (signature && from && messageStore[from]) {
    // 簽名：signature
    // public addr：from
    // qrcode message：messageStore[from]
    
    const data = messageStore[from];
    const signature1 = ethUtil.toBuffer(signature)
    const message = ethUtil.toBuffer(data)
    const msgHash = ethUtil.hashPersonalMessage(message)
    const sigParams = ethUtil.fromRpcSig(signature1)
    const publicKey = ethUtil.ecrecover(
      msgHash,
      sigParams.v,
      sigParams.r,
      sigParams.s
    )
    const sender = ethUtil.publicToAddress(publicKey)
    const addr = ethUtil.bufferToHex(sender)

    if (addr !== messageStore[from]) {
      console.log('驗證失敗')
      Verified = 'fail'
      res.send('Failed to verify');
    } else {
      console.log('驗證成功。')
      Verified = 'success'
      res.send('Verified');
    }

  }
  
  const target = Object
    .entries(conTable)
    .find(([socketId, userAccount], ) => userAccount === from)
  console.log(target)
  if (target && target.length > 0) {
    io.sockets.connected[target[0]].emit(
      'verify',
      Verified,
    );
  }
  res.end();

});

app.get('/qrcode', function(req, res) {
  var code = qr.image(req.query.qrurl, { type: 'png' });
  res.type('png');
  code.pipe(res);
});

io.on('connection', function (socket) {
  console.log("一位使用者已連接. Socket id = ", socket.id);

  socket.on('join', function (userAccount) {
    // console.log('account => ' + userAccount)
    // console.log('join 的 id => ' + socket.id)
    if (conTable[socket.id] === undefined) {
      conTable[socket.id] = userAccount;
    }
  });

  socket.on('leave', function (rooms) {
    console.log('Socket %s unSubScribed from %s', socket.id, rooms);

    if (conTable[socket.id] !== undefined) {
      delete conTable[socket.id];
    }

  });

  socket.on('disconnect', function () {
    console.log('一位使用者離開了 %s Socket id %s', socket.id);
    if (conTable[socket.id] !== undefined) {
      delete conTable[socket.id];
    }
  });
}); 

const port = process.env.PORT || 8088

http.listen(port, function () {
  console.log('listening on *:' + port);
});

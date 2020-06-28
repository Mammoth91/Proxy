const http = require('http')
const port = process.env.PORT || 6969
const net = require('net')
const url = require('url')

const requestHandler = (req, res) => {
  res.writeHead(405, {
    'Content-Type': 'text/plain'
  })
  res.end('Method not allowed')
}

const server = http.createServer(requestHandler)

const listener = server.listen(port, (err) => {
  if (err) {
    return console.error(err)
  }
  const info = listener.address()
  console.log(`Server is listening on address ${info.address} port ${info.port}`)
})

server.on('connect', (req, clientSocket, head) => { // listen only for HTTP/1.1 CONNECT method
  console.log(clientSocket.remoteAddress, clientSocket.remotePort, req.method, req.url)
  console.log(req.headers['proxy-authorization'])
  //if (!req.headers['proxy-authorization']) { // here you can add check for any username/password, I just check that this header must exist!
  //  clientSocket.write([
  //    'HTTP/1.1 407 Proxy Authentication Required',
  //    'Proxy-Authenticate: Basic realm="proxy"',
  //    'Proxy-Connection: close',
  //  ].join('\r\n'))
  //  clientSocket.end('\r\n\r\n') // empty body
  //  return
  //}
  const {
    port,
    hostname
  } = url.parse(`//${req.url}`, false, true)
  if (hostname && port) {
    const serverErrorHandler = (err) => {
      console.error(err.message)
      if (clientSocket) {
        clientSocket.end(`HTTP/1.1 500 ${err.message}\r\n`)
      }
    }
    const serverEndHandler = () => {
      if (clientSocket) {
        clientSocket.end(`HTTP/1.1 500 External Server End\r\n`)
      }
    }
    const serverSocket = net.connect(port, hostname)
    const clientErrorHandler = (err) => {
      console.error(err.message)
      if (serverSocket) {
        serverSocket.end()
      }
    }
    const clientEndHandler = () => {
      if (serverSocket) {
        serverSocket.end()
      }
    }
    clientSocket.on('error', clientErrorHandler)
    clientSocket.on('end', clientEndHandler)
    serverSocket.on('error', serverErrorHandler)
    serverSocket.on('end', serverEndHandler)
    serverSocket.on('connect', () => {
      clientSocket.write([
        'HTTP/1.1 200 Connection Established',
        'Proxy-agent: Aqua-Proxy',
      ].join('\r\n'))
      clientSocket.write('\r\n\r\n')
      serverSocket.pipe(clientSocket, {
        end: false
      })
      clientSocket.pipe(serverSocket, {
        end: false
      })
    })
  } else {
    clientSocket.end('HTTP/1.1 400 Bad Request\r\n')
    clientSocket.destroy()
  }
})

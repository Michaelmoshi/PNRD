const http = require('http');
const fs = require('fs');
const path = require('path');

const port = 5500;

const server = http.createServer((req, res) => {
  let filePath = path.join(__dirname, req.url === '/' ? 'index.html' : req.url);
  
  const extname = path.extname(filePath);
  let contentType = 'text/html';

  switch (extname) {
    case '.js':
      contentType = 'text/javascript';
      break;
    case '.css':
      contentType = 'text/css';
      break;
    case '.json':
      contentType = 'application/json';
      break;
    case '.png':
      contentType = 'image/png';
      break;
    case '.jpg':
    case '.jpeg':
      contentType = 'image/jpeg';
      break;
  }

  fs.readFile(filePath, (error, content) => {
    if (error) {
      res.writeHead(404);
      res.end('Page non trouvée');
    } else {
      res.writeHead(200, {'Content-Type': contentType});
      res.end(content, 'utf-8');
    }
  });
});

server.listen(port, () => {
  console.log(`Serveur démarré sur http://localhost:${port}`);
});

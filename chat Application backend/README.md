# 💬 Real-Time Chat Application

A full-stack real-time chat application that allows users to register/login, create or join chat rooms, and communicate instantly using WebSockets. Users can edit, delete, and pin messages, while room owners can delete rooms.

---

## 🌐 Live Features

- 👤 User registration & login  
- 🏠 Create and join chat rooms  
- 💬 Real-time messaging with Socket.IO  
- ✏️ Edit and 🗑️ delete messages  
- 📌 Pin/unpin messages  
- 🔐 Cookie and localStorage based session handling  
- 🧹 Room owner can delete the room  
- 🚪 Members can leave the room  
- 🌍 RESTful API + WebSocket communication  

---

## 🛠️ Tech Stack

### 🔧 Backend
- Node.js + Express.js
- MongoDB + Mongoose
- Socket.IO

### 🎨 Frontend
- HTML, CSS, JavaScript (Vanilla)

---

## 📁 Project Structure

```
chat-Application/
├── chat Application backend/
│   ├── controller/         # Handles request logic (Auth, Room, Message)
│   ├── database/           # MongoDB connection config
│   ├── middleware/         # Custom auth or error handling middleware
│   ├── model/              # Mongoose schemas for User, Room, Message
│   ├── router/             # API route definitions
│   ├── services/           # Utility functions or business logic services
│   ├── .env                # Environment variables
│   ├── .gitignore
│   ├── app.js              # Express app setup
│   ├── server.js           # Server start and Socket.IO integration
│   ├── package.json
│   └── package-lock.json
│
├── Chat application frontend/
│   ├── index.html          # Home/Landing page
│   ├── login.html          # Login page UI
│   ├── login.js            # Login logic
│   ├── register.js         # Register logic
│   ├── mainPage.html       # Dashboard to create/join rooms
│   ├── mainPage.js         # Frontend logic for mainPage.html
│   ├── room.html           # Actual chat room UI
│   ├── room.js             # Chat functionality with Socket.IO
│   └── readme.md
```

---

## 🚀 Getting Started

### 📦 Prerequisites

- Node.js installed
- MongoDB running locally or via MongoDB Atlas

### 🔧 Environment Setup

Create a `.env` file in the root:

```
PORT=5000
MONGODB_URI=mongodb://localhost:27017/chatApp
```

### 📥 Install Dependencies

```
npm install
```

### 🏃 Run the Server

```
npm start
```

---

## 🌐 How to Use

1. Open `index.html` or `login.html` in your browser  
2. Register or login with your username and password  
3. Create a new room or join an existing one  
4. Start chatting in real-time  
5. Use buttons to edit, delete, or pin messages  
6. Room owners can delete rooms; others can leave

---

## 🧪 Sample REST API Endpoints

| Method | Endpoint             | Description              |
|--------|----------------------|--------------------------|
| POST   | /auth/register       | Register new user        |
| POST   | /auth/login          | Login user               |
| POST   | /room/createroom     | Create a new room        |
| POST   | /room/joinroom       | Join an existing room    |
| GET    | /room/deleteroom     | Delete a room (owner)    |
| POST   | /room/leaveroom      | Leave a room             |
| GET    | /room/gelallroom     | Get list of all rooms    |
| POST   | /message/edit        | Edit a message           |
| POST   | /message/delete      | Delete a message         |

---

## 📦 Dependencies

- express  
- mongoose  
- socket.io  
- dotenv  
- cookie-parser  
- cors  
- nodemon (dev)

---

## 🤝 Contributing

```
git clone https://github.com/RohitBCA456/chat-Application.git
cd chat-Application
git checkout -b feature/myFeature
git commit -m "Add some feature"
git push origin feature/myFeature
```

---

## 📄 License

MIT License © [Rohit Yadav](https://github.com/RohitBCA456)

---

## 🙋‍♂️ Acknowledgments

- Socket.IO Documentation  
- MongoDB Docs  
- Node.js & Express Docs

// import logo from './logo.svg';
// import './App.css';
import { PostList } from './components/PostList';
import { Post } from './components/Post';
import { Routes,Route, Router } from 'react-router-dom';
import { PostProvider } from "./context/PostContext"
function App() {

  return (
    <div className="container">
  < Routes>
  <Route path='/' element={<PostList/>}  />
  <Route path='/posts/:id' element={ 
   <PostProvider>
      <Post/>
      </PostProvider>
  }  />
  </Routes>
   </div>
  );
}

export default App;

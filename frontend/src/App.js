import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider } from './context/AuthContext.jsx';
import Layout from './components/Layout.jsx';
import Home from './pages/Home.jsx';
import Login from './pages/Login.jsx';
import Signup from './pages/Signup.jsx';

/*
 * The root component. It sets up two things for the whole app:
 *
 * 1. <AuthProvider> - makes the logged-in student available to every component
 * 2. <BrowserRouter> - decides which page to show for the current address
 *
 * The `future` flags simply opt in early to React Router v7 behaviour, which
 * keeps the development console free of upgrade warnings.
 */
function App() {
  return (
    <AuthProvider>
      <BrowserRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
        <Routes>
          {/*
            Pages wrapped in <Layout /> get the navbar and footer.
            The landing page is the only one, and `index` means the "/" address.
          */}
          <Route element={<Layout />}>
            <Route index element={<Home />} />
          </Route>

          {/*
            The auth pages sit outside <Layout /> on purpose: they are full
            screen navy cards, with no navbar or footer around them.
          */}
          <Route path="/login" element={<Login />} />
          <Route path="/signup" element={<Signup />} />

          {/* Any unknown address sends the visitor back to the landing page. */}
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  );
}

export default App;

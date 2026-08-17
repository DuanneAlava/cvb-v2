import { Outlet } from 'react-router-dom';
import Navbar from './Navbar.jsx';
import Footer from './Footer.jsx';

/*
 * The shared page frame: navbar on top, footer at the bottom, and whatever
 * page the router picked in the middle.
 *
 * <Outlet /> is the slot React Router fills with the matching page.
 * `min-h-screen` plus `flex-1` on the middle keeps the footer at the bottom
 * of the window even when a page has very little content.
 */
function Layout() {
  return (
    <div className="flex min-h-screen flex-col bg-slate-50">
      <Navbar />
      <main className="flex-1">
        <Outlet />
      </main>
      <Footer />
    </div>
  );
}

export default Layout;

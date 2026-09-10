import { Outlet } from 'react-router-dom';
import Navbar from './Navbar.jsx';
import Footer from './Footer.jsx';

/*
 * The shared page frame: navbar on top, footer at the bottom, and whatever
 * page the router picked in the middle.
 *
 * <Outlet /> is the slot React Router fills with the matching page, and a page
 * that is not a routed child can pass its content as children instead.
 * `min-h-screen` plus `flex-1` on the middle keeps the footer at the bottom
 * of the window even when a page has very little content.
 */
function Layout({ children }) {
  return (
    <div className="flex min-h-screen flex-col bg-slate-50">
      <Navbar />
      <main className="flex-1">
        {/*
          Two ways in, because two kinds of page need this frame:
          - as a route wrapper, where the router fills <Outlet /> with the
            matching page (that is how the board is rendered)
          - wrapped directly around a page's own markup, which is what the
            student dashboard and account pages do
          Supporting both keeps one navbar and one footer for the whole
          student-facing site instead of a second copy for the newer pages.
        */}
        {children ?? <Outlet />}
      </main>
      <Footer />
    </div>
  );
}

export default Layout;

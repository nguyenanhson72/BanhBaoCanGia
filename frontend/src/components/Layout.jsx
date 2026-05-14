import React, { useState } from "react";
import { Outlet } from "react-router-dom";
import Sidebar from "./Sidebar";
import Header from "./Header";
import ChatWidget from "./ChatWidget";

export default function Layout() {
  const [mobileOpen, setMobileOpen] = useState(false);
  return (
    <div className="min-h-screen bg-paper">
      <Sidebar mobileOpen={mobileOpen} onClose={() => setMobileOpen(false)} />
      <div className="md:ml-64">
        <Header onMenu={() => setMobileOpen(true)} />
        <main className="p-4 md:p-8 max-w-[1400px] mx-auto" data-testid="main-content">
          <Outlet />
        </main>
      </div>
      <ChatWidget />
    </div>
  );
}

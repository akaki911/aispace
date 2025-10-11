// 📁 src/layout/AdminLayout.tsx
import React from "react";
import { Outlet } from "react-router-dom";
import Header from "../components/Header";
import Footer from "../components/Footer";
import { useAuth } from "../contexts/useAuth";
import { headerTokens } from "../components/layout/headerTokens";

type LayoutStyle = React.CSSProperties & {
  '--header-h'?: string;
  '--safe-padding'?: string;
};

const AdminLayout = () => {
  const { user } = useAuth();

  const layoutStyle: LayoutStyle = {
    '--header-h': `${headerTokens.height}px`,
    '--safe-padding': `${headerTokens.safePadding.desktop}px`
  };

  return (
    <div className="min-h-screen flex flex-col bg-gray-50" style={layoutStyle}>
      <Header />
      <main className="flex-1 p-4">
        <Outlet />
      </main>
      <Footer />
    </div>
  );
};

export default AdminLayout;

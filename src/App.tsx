/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import AdminLayout from './layouts/AdminLayout';
import PublicLayout from './layouts/PublicLayout';
import Dashboard from './pages/admin/Dashboard';
import RifasList from './pages/admin/RifasList';
import RifaForm from './pages/admin/RifaForm';
import VendedoresList from './pages/admin/VendedoresList';
import Configuracoes from './pages/admin/Configuracoes';
import Login from './pages/admin/Login';
import PedidosList from './pages/admin/PedidosList';
import PerfilVendedor from './pages/admin/PerfilVendedor';
import Home from './pages/public/Home';
import RifaDetails from './pages/public/RifaDetails';
import MinhasCompras from './pages/public/MinhasCompras';
import Terms from './pages/public/Terms';
import Privacy from './pages/public/Privacy';
import Recrutamento from './pages/admin/Recrutamento';
import RankingList from './pages/admin/RankingList';

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        {/* Public Routes */}
        <Route element={<PublicLayout />}>
          <Route path="/" element={<Home />} />
          <Route path="/:id" element={<RifaDetails />} />
          <Route path="/minhas-compras" element={<MinhasCompras />} />
        </Route>
        
        {/* Independent Public Routes (No Global Header) */}
        <Route path="/termos" element={<Terms />} />
        <Route path="/privacidade" element={<Privacy />} />
        
        {/* Admin Routes */}
        <Route path="/admin/login" element={<Login />} />
        <Route path="/admin/recrutamento" element={<Recrutamento />} />
        <Route path="/admin" element={<AdminLayout />}>
          <Route index element={<Dashboard />} />
          <Route path="rifas" element={<RifasList />} />
          <Route path="rifas/nova" element={<RifaForm />} />
          <Route path="rifas/:id/editar" element={<RifaForm />} />
          <Route path="pedidos" element={<PedidosList />} />
          <Route path="vendedores" element={<VendedoresList />} />
          <Route path="ranking" element={<RankingList />} />
          <Route path="perfil" element={<PerfilVendedor />} />
          <Route path="configuracoes" element={<Configuracoes />} />
        </Route>
        
        {/* Fallback */}
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  );
}

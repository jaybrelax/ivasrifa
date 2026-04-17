import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import AdminLayout from './layouts/AdminLayout';
import Dashboard from './pages/admin/Dashboard';
import RifasList from './pages/admin/RifasList';
import RifaForm from './pages/admin/RifaForm';
import VendedoresList from './pages/admin/VendedoresList';
import Configuracoes from './pages/admin/Configuracoes';
import Login from './pages/admin/Login';
import PedidosList from './pages/admin/PedidosList';
import PerfilVendedor from './pages/admin/PerfilVendedor';
import Recrutamento from './pages/admin/Recrutamento';
import RankingList from './pages/admin/RankingList';

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        {/* Auth Route */}
        <Route path="/login" element={<Login />} />
        <Route path="/recrutamento" element={<Recrutamento />} />
        
        {/* Admin Protected Routes */}
        <Route path="/" element={<AdminLayout />}>
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
        
        {/* Fallback to Admin Dashboard */}
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  );
}

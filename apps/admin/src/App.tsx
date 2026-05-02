import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import AdminLayout from './layouts/AdminLayout';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import Dashboard from './pages/admin/Dashboard';
import RifasList from './pages/admin/RifasList';
import RifaForm from './pages/admin/RifaForm';
import VendedoresList from './pages/admin/VendedoresList';
import Configuracoes from './pages/admin/Configuracoes';
import Login from './pages/admin/Login';
import VendasList from './pages/admin/PedidosList';
import PerfilVendedor from './pages/admin/PerfilVendedor';
import Recrutamento from './pages/admin/Recrutamento';
import RankingList from './pages/admin/RankingList';
import NovaSenha from './pages/admin/NovaSenha';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      refetchOnWindowFocus: false,
      staleTime: 1000 * 60 * 5, // 5 minutos de cache
    },
  },
});

export default function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        <Routes>
          {/* Auth Route */}
          <Route path="/login" element={<Login />} />
          <Route path="/recrutamento" element={<Recrutamento />} />
          <Route path="/nova-senha" element={<NovaSenha />} />
          
          {/* Admin Protected Routes */}
          <Route path="/" element={<AdminLayout />}>
            <Route index element={<Dashboard />} />
            <Route path="rifas" element={<RifasList />} />
            <Route path="rifas/nova" element={<RifaForm />} />
            <Route path="rifas/:id/editar" element={<RifaForm />} />
            <Route path="vendas" element={<VendasList />} />
            <Route path="vendedores" element={<VendedoresList />} />
            <Route path="ranking" element={<RankingList />} />
            <Route path="perfil" element={<PerfilVendedor />} />
            <Route path="configuracoes" element={<Configuracoes />} />
          </Route>
          
          {/* Fallback to Admin Dashboard */}
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </BrowserRouter>
    </QueryClientProvider>
  );
}

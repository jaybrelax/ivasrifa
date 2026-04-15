import * as React from 'react';
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Ticket, Loader2, ShieldCheck } from 'lucide-react';
import { supabase } from '@/src/lib/supabase';
import logo from '@/src/img/ivas_logo.png';

export default function Login() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const navigate = useNavigate();

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    try {
      const { error } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      if (error) throw error;
      
      navigate('/admin');
    } catch (err: any) {
      setError(err.message || 'Erro ao fazer login. Verifique suas credenciais.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col justify-center py-12 px-4 sm:px-6 lg:px-8 bg-[radial-gradient(circle_at_top_right,_var(--tw-gradient-stops))] from-blue-50/50 via-slate-50 to-slate-100/50">
      <div className="sm:mx-auto sm:w-full sm:max-w-md">
        <div className="flex justify-center mb-6">
          <img src={logo} alt="IVAS Logo" className="h-20 w-auto object-contain" />
        </div>
        <h2 className="text-center text-3xl font-bold text-slate-900 tracking-tight">
          Acesso Restrito
        </h2>
        <p className="mt-2 text-center text-sm text-slate-500 font-medium uppercase tracking-widest">
          Administração do Sistema
        </p>
      </div>

      <div className="mt-8 sm:mx-auto sm:w-full sm:max-w-md">
        <Card className="border-none shadow-2xl shadow-blue-900/5 rounded-2xl overflow-hidden bg-white/80 backdrop-blur-sm">
          <CardHeader className="space-y-1 pb-6 pt-8">
            <CardTitle className="text-2xl font-bold tracking-tight">Login</CardTitle>
            <CardDescription className="text-slate-500">Insira suas credenciais para acessar o painel.</CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleLogin} className="space-y-5">
              {error && (
                <div className="bg-red-50 border border-red-200 text-red-600 text-sm p-3 rounded-md">
                  {error}
                </div>
              )}
              <div className="space-y-2">
                <Label htmlFor="email" className="text-sm font-semibold text-slate-700 ml-1">E-mail</Label>
                <Input
                  id="email"
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="admin@exemplo.com"
                  className="h-12 rounded-xl border-slate-200 focus:border-blue-500 focus:ring-blue-500/10 transition-all text-base"
                />
              </div>

              <div className="space-y-2">
                <div className="flex items-center justify-between ml-1">
                  <Label htmlFor="password" name="Senha" className="text-sm font-semibold text-slate-700">Senha</Label>
                </div>
                <Input
                  id="password"
                  type="password"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="h-12 rounded-xl border-slate-200 focus:border-blue-500 focus:ring-blue-500/10 transition-all text-base"
                />
              </div>

              <div className="pt-2">
                <Button type="submit" className="w-full h-12 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-xl shadow-lg shadow-blue-500/20 transition-all hover:scale-[1.01] active:scale-[0.99]" disabled={loading}>
                  {loading ? <Loader2 className="mr-2 h-5 w-5 animate-spin" /> : <ShieldCheck className="mr-2 h-5 w-5" />}
                  Entrar no Painel
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

import * as React from 'react';
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Ticket, Loader2, ShieldCheck } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import logo from '@/img/ivas_logo.png';

export default function Login() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [isForgotPassword, setIsForgotPassword] = useState(false);
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
      
      navigate('/');
    } catch (err: any) {
      setError(err.message || 'Erro ao fazer login. Verifique suas credenciais.');
    } finally {
      setLoading(false);
    }
  };

  const handleResetPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    setSuccessMessage(null);

    if (!email) {
      setError('Por favor, informe seu e-mail para recuperar a senha.');
      setLoading(false);
      return;
    }

    try {
      const { error } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: `${window.location.origin}/nova-senha`,
      });

      if (error) throw error;

      setSuccessMessage('E-mail de recuperação enviado com sucesso. Verifique sua caixa de entrada e spam.');
    } catch (err: any) {
      setError(err.message || 'Erro ao enviar e-mail de recuperação.');
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
            <CardTitle className="text-2xl font-bold tracking-tight">
              {isForgotPassword ? 'Recuperar Senha' : 'Login'}
            </CardTitle>
            <CardDescription className="text-slate-500">
              {isForgotPassword 
                ? 'Insira seu e-mail para receber um link de redefinição.' 
                : 'Insira suas credenciais para acessar o painel.'}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={isForgotPassword ? handleResetPassword : handleLogin} className="space-y-5">
              {error && (
                <div className="bg-red-50 border border-red-200 text-red-600 text-sm p-3 rounded-md">
                  {error}
                </div>
              )}
              {successMessage && (
                <div className="bg-green-50 border border-green-200 text-green-700 text-sm p-3 rounded-md">
                  {successMessage}
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

              {!isForgotPassword && (
                <div className="space-y-2">
                  <div className="flex items-center justify-between ml-1">
                    <Label htmlFor="password" name="Senha" className="text-sm font-semibold text-slate-700">Senha</Label>
                    <button 
                      type="button" 
                      onClick={() => { setIsForgotPassword(true); setError(null); setSuccessMessage(null); }}
                      className="text-xs font-semibold text-blue-600 hover:text-blue-500 transition-colors"
                    >
                      Esqueceu a senha?
                    </button>
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
              )}

              <div className="pt-2 flex flex-col space-y-3">
                <Button type="submit" className="w-full h-12 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-xl shadow-lg shadow-blue-500/20 transition-all hover:scale-[1.01] active:scale-[0.99]" disabled={loading}>
                  {loading ? <Loader2 className="mr-2 h-5 w-5 animate-spin" /> : <ShieldCheck className="mr-2 h-5 w-5" />}
                  {isForgotPassword ? 'Enviar Link' : 'Entrar no Painel'}
                </Button>
                
                {isForgotPassword && (
                  <button 
                    type="button"
                    onClick={() => { setIsForgotPassword(false); setError(null); setSuccessMessage(null); }}
                    className="text-sm text-slate-500 hover:text-slate-700 font-medium transition-colors"
                  >
                    Voltar para o Login
                  </button>
                )}
              </div>
            </form>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

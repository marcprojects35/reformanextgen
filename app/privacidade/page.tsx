import type { Metadata } from 'next'
import Link from 'next/link'
import Image from 'next/image'

export const metadata: Metadata = {
  title: 'Política de Privacidade — Reforma NextGen',
  description: 'Como coletamos, usamos e protegemos seus dados pessoais em conformidade com a LGPD.',
}

const LAST_UPDATED = '17 de junho de 2026'

export default function PrivacidadePage() {
  return (
    <main className="min-h-screen bg-background">
      <header className="border-b border-border">
        <div className="mx-auto flex max-w-4xl items-center justify-between px-4 py-4 md:px-6">
          <Link href="/" className="flex items-center gap-2">
            <Image src="/logo.png" alt="Reforma NextGen" width={32} height={32} className="h-8 w-8" />
            <span className="text-sm font-semibold tracking-tight">
              Reforma<span className="text-primary">NextGen</span>
            </span>
          </Link>
          <Link
            href="/"
            className="text-sm text-muted-foreground transition-colors hover:text-foreground"
          >
            Voltar ao início
          </Link>
        </div>
      </header>

      <article className="mx-auto max-w-4xl px-4 py-16 md:px-6">
        <h1 className="text-3xl font-semibold tracking-tight">Política de Privacidade</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Última atualização: {LAST_UPDATED}
        </p>

        <div className="prose prose-sm mt-10 max-w-none text-foreground [&_a]:text-primary [&_a]:underline [&_h2]:mt-10 [&_h2]:text-xl [&_h2]:font-semibold [&_h2]:tracking-tight [&_h3]:mt-6 [&_h3]:text-base [&_h3]:font-semibold [&_li]:mt-2 [&_p]:mt-4 [&_p]:leading-relaxed [&_p]:text-foreground/80 [&_ul]:mt-4 [&_ul]:list-disc [&_ul]:pl-5">
          <p>
            A <strong>ReformaNextGen</strong> (&quot;nós&quot;, &quot;nosso&quot;) respeita sua privacidade e está comprometida
            com a proteção dos seus dados pessoais, em conformidade com a Lei Geral de Proteção de
            Dados (LGPD — Lei n.º 13.709/2018) e demais legislações aplicáveis.
          </p>
          <p>
            Esta política explica quais dados coletamos, como os usamos, com quem os compartilhamos
            e quais são os seus direitos como titular dos dados.
          </p>

          <h2>1. Quem é o Controlador dos Dados</h2>
          <p>
            O controlador responsável pelo tratamento dos seus dados pessoais é a plataforma
            ReformaNextGen. Para dúvidas ou exercício de direitos, entre em contato via e-mail:{' '}
            <a href="mailto:privacidade@reformanextgen.com.br">privacidade@reformanextgen.com.br</a>.
          </p>

          <h2>2. Dados que Coletamos</h2>
          <h3>2.1 Dados de Cadastro</h3>
          <p>Ao criar uma conta, coletamos:</p>
          <ul>
            <li>Nome completo</li>
            <li>Endereço de e-mail</li>
            <li>Senha (armazenada de forma irreversível via hashing criptográfico)</li>
          </ul>

          <h3>2.2 Dados da Empresa</h3>
          <p>Para realizar simulações, você pode informar:</p>
          <ul>
            <li>Razão social e CNPJ (opcional)</li>
            <li>Setor de atividade e estado (UF)</li>
            <li>Regime tributário, faturamento anual e margem de lucro estimada</li>
          </ul>

          <h3>2.3 Arquivos Fiscais (opcional)</h3>
          <p>
            Caso opte por maior precisão, você pode enviar arquivos de notas fiscais (XML NF-e),
            registros EFD/SPED, planilhas XLSX ou arquivos JSON. Esses arquivos são processados
            automaticamente para extração de dados tributários e não são lidos por pessoas da nossa
            equipe.
          </p>

          <h3>2.4 Dados de Uso</h3>
          <p>
            Coletamos automaticamente dados de navegação como endereço IP, tipo de navegador,
            páginas acessadas e duração da sessão, por meio de ferramentas de analytics (Vercel
            Analytics) para melhorar a plataforma.
          </p>

          <h2>3. Finalidade e Base Legal do Tratamento</h2>
          <ul>
            <li>
              <strong>Execução do contrato:</strong> prestação do serviço de simulação tributária
              que você contratou.
            </li>
            <li>
              <strong>Legítimo interesse:</strong> melhoria da plataforma, prevenção de fraudes e
              segurança da informação.
            </li>
            <li>
              <strong>Cumprimento de obrigação legal:</strong> atendimento a requisições de
              autoridades competentes.
            </li>
            <li>
              <strong>Consentimento:</strong> envio de comunicações de marketing, quando aplicável
              (você pode revogar a qualquer momento).
            </li>
          </ul>

          <h2>4. Compartilhamento de Dados</h2>
          <p>
            Não vendemos seus dados pessoais. Podemos compartilhá-los apenas com:
          </p>
          <ul>
            <li>
              <strong>Provedores de infraestrutura:</strong> serviços de hospedagem (Vercel) que
              operam sob contratos de proteção de dados adequados.
            </li>
            <li>
              <strong>Autoridades públicas:</strong> quando exigido por lei, decisão judicial ou
              requisição de autoridade competente.
            </li>
          </ul>

          <h2>5. Retenção de Dados</h2>
          <p>
            Seus dados são mantidos enquanto sua conta estiver ativa. Após o encerramento, os dados
            são excluídos em até 90 dias, salvo obrigação legal de retenção por prazo superior.
          </p>
          <p>
            Os arquivos fiscais enviados para simulação são armazenados associados à simulação e
            excluídos junto com ela quando você optar por excluir a simulação ou a conta.
          </p>

          <h2>6. Segurança</h2>
          <p>
            Adotamos medidas técnicas e organizacionais para proteger seus dados, incluindo:
          </p>
          <ul>
            <li>Senhas armazenadas com derivação de chave (scrypt) + salt único por usuário</li>
            <li>Sessões autenticadas via cookie HMAC-SHA256 com expiração de 7 dias</li>
            <li>Transmissão de dados via HTTPS/TLS</li>
            <li>Banco de dados não exposto à internet pública</li>
          </ul>

          <h2>7. Seus Direitos (LGPD)</h2>
          <p>Conforme a LGPD, você tem direito a:</p>
          <ul>
            <li>Confirmação de existência de tratamento dos seus dados</li>
            <li>Acesso aos dados que temos sobre você</li>
            <li>Correção de dados incompletos, inexatos ou desatualizados</li>
            <li>Anonimização, bloqueio ou eliminação de dados desnecessários</li>
            <li>Portabilidade dos dados a outro fornecedor</li>
            <li>Eliminação dos dados tratados com base em consentimento</li>
            <li>Revogação do consentimento a qualquer momento</li>
            <li>Apresentação de reclamação à ANPD</li>
          </ul>
          <p>
            Para exercer qualquer um desses direitos, envie um e-mail para{' '}
            <a href="mailto:privacidade@reformanextgen.com.br">privacidade@reformanextgen.com.br</a>.
          </p>

          <h2>8. Cookies</h2>
          <p>
            Utilizamos apenas cookies estritamente necessários para autenticação (cookie de sessão
            httpOnly) e analytics anônimo. Não utilizamos cookies de publicidade ou rastreamento
            cross-site.
          </p>

          <h2>9. Alterações a esta Política</h2>
          <p>
            Podemos atualizar esta política periodicamente. Quando houver mudanças relevantes,
            notificaremos você por e-mail ou por aviso na plataforma com pelo menos 15 dias de
            antecedência.
          </p>

          <h2>10. Contato</h2>
          <p>
            Dúvidas, solicitações ou reclamações relacionadas à privacidade:{' '}
            <a href="mailto:privacidade@reformanextgen.com.br">privacidade@reformanextgen.com.br</a>
          </p>
        </div>

        <div className="mt-12 flex items-center gap-4 border-t border-border pt-8 text-sm text-muted-foreground">
          <Link href="/termos" className="hover:text-foreground hover:underline">
            Termos de Uso
          </Link>
          <span>·</span>
          <Link href="/" className="hover:text-foreground hover:underline">
            Voltar ao início
          </Link>
        </div>
      </article>
    </main>
  )
}

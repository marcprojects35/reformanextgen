import type { Metadata } from 'next'
import Link from 'next/link'
import Image from 'next/image'

export const metadata: Metadata = {
  title: 'Termos de Uso — Reforma NextGen',
  description: 'Condições de uso da plataforma ReformaNextGen.',
}

const LAST_UPDATED = '17 de junho de 2026'

export default function TermosPage() {
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
        <h1 className="text-3xl font-semibold tracking-tight">Termos de Uso</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Última atualização: {LAST_UPDATED}
        </p>

        <div className="prose prose-sm mt-10 max-w-none text-foreground [&_a]:text-primary [&_a]:underline [&_h2]:mt-10 [&_h2]:text-xl [&_h2]:font-semibold [&_h2]:tracking-tight [&_h3]:mt-6 [&_h3]:text-base [&_h3]:font-semibold [&_li]:mt-2 [&_p]:mt-4 [&_p]:leading-relaxed [&_p]:text-foreground/80 [&_ul]:mt-4 [&_ul]:list-disc [&_ul]:pl-5">
          <p>
            Bem-vindo à <strong>ReformaNextGen</strong>. Ao criar uma conta ou utilizar nossa
            plataforma, você concorda com os presentes Termos de Uso. Leia-os atentamente.
          </p>

          <h2>1. Descrição do Serviço</h2>
          <p>
            A ReformaNextGen é uma plataforma SaaS que oferece simulações do impacto da Reforma
            Tributária Brasileira (EC 132/2023, LC 214/2025) sobre empresas. Os resultados gerados
            têm caráter meramente informativo e estimativo, não constituindo parecer jurídico,
            contábil ou tributário.
          </p>
          <p>
            As alíquotas, cronogramas de transição e regras utilizadas são baseadas em premissas
            de referência e podem diferir da regulamentação final ainda em elaboração. Consulte
            sempre um profissional habilitado para decisões tributárias.
          </p>

          <h2>2. Elegibilidade</h2>
          <p>
            O serviço é destinado a pessoas físicas maiores de 18 anos e pessoas jurídicas
            regularmente constituídas, com capacidade legal para contratar. Ao se cadastrar, você
            declara que atende a esses requisitos.
          </p>

          <h2>3. Cadastro e Conta</h2>
          <ul>
            <li>Você é responsável por manter as credenciais de acesso em sigilo.</li>
            <li>
              O e-mail informado no cadastro será o identificador único da conta e não poderá ser
              alterado após o registro.
            </li>
            <li>
              É proibido criar contas com dados falsos, duplicar contas ou utilizar a plataforma em
              nome de terceiros sem autorização.
            </li>
            <li>
              Notifique-nos imediatamente em caso de uso não autorizado da sua conta via{' '}
              <a href="mailto:suporte@reformanextgen.com.br">suporte@reformanextgen.com.br</a>.
            </li>
          </ul>

          <h2>4. Uso Permitido</h2>
          <p>Você pode utilizar a plataforma para:</p>
          <ul>
            <li>Simular o impacto tributário da Reforma para sua própria empresa.</li>
            <li>
              Gerar análises comparativas de regimes tributários (Simples, Presumido, Real, IVA
              Dual).
            </li>
            <li>Exportar relatórios para uso interno ou apresentação a clientes (se profissional da área contábil).</li>
          </ul>

          <h2>5. Uso Proibido</h2>
          <p>É expressamente proibido:</p>
          <ul>
            <li>Utilizar a plataforma para finalidades ilegais ou fraudulentas.</li>
            <li>Realizar engenharia reversa, decompilar ou extrair o código-fonte da plataforma.</li>
            <li>
              Utilizar bots, scrapers ou qualquer meio automatizado para acessar a plataforma sem
              autorização prévia por escrito.
            </li>
            <li>Revender, sublicenciar ou redistribuir o acesso à plataforma sem autorização.</li>
            <li>
              Enviar arquivos maliciosos, vírus ou qualquer conteúdo que comprometa a segurança da
              plataforma ou de outros usuários.
            </li>
          </ul>

          <h2>6. Propriedade Intelectual</h2>
          <p>
            Todo o conteúdo da plataforma — incluindo código-fonte, design, textos, logotipos e
            motor de cálculo — é de propriedade exclusiva da ReformaNextGen ou de seus licenciantes
            e protegido pelas leis de propriedade intelectual aplicáveis.
          </p>
          <p>
            Os dados e arquivos que você envia permanecem de sua propriedade. Você nos concede
            apenas a licença necessária para processá-los e gerar os resultados das simulações.
          </p>

          <h2>7. Isenção de Responsabilidade</h2>
          <p>
            Os resultados das simulações são baseados em premissas de referência e têm caráter
            informativo. A ReformaNextGen não se responsabiliza por decisões tomadas com base nos
            resultados da plataforma, nem por eventuais divergências em relação à regulamentação
            tributária vigente ou futura.
          </p>
          <p>
            A plataforma é fornecida &quot;como está&quot; (<em>as is</em>), sem garantias expressas ou
            implícitas de disponibilidade ininterrupta, adequação a uma finalidade específica ou
            ausência de erros.
          </p>

          <h2>8. Limitação de Responsabilidade</h2>
          <p>
            Na máxima extensão permitida pela lei, a ReformaNextGen não será responsável por danos
            indiretos, incidentais, especiais, consequenciais ou punitivos, incluindo perda de
            lucros, perda de dados ou interrupção de negócios, decorrentes do uso ou da
            impossibilidade de uso da plataforma.
          </p>

          <h2>9. Suspensão e Encerramento</h2>
          <p>
            Reservamo-nos o direito de suspender ou encerrar sua conta, com ou sem aviso prévio, em
            caso de violação destes Termos ou por qualquer motivo legítimo de negócio.
          </p>
          <p>
            Você pode encerrar sua conta a qualquer momento entrando em contato com nosso suporte.
            Após o encerramento, seus dados serão tratados conforme descrito na{' '}
            <Link href="/privacidade">Política de Privacidade</Link>.
          </p>

          <h2>10. Alterações nos Termos</h2>
          <p>
            Podemos revisar estes Termos periodicamente. Quando houver mudanças relevantes,
            notificaremos você com pelo menos 15 dias de antecedência por e-mail ou aviso na
            plataforma. O uso continuado após a data de vigência das alterações implica aceitação
            dos novos termos.
          </p>

          <h2>11. Lei Aplicável e Foro</h2>
          <p>
            Estes Termos são regidos pelas leis da República Federativa do Brasil. Fica eleito o
            foro da comarca de São Paulo — SP para dirimir quaisquer controvérsias, com renúncia a
            qualquer outro, por mais privilegiado que seja.
          </p>

          <h2>12. Contato</h2>
          <p>
            Para dúvidas sobre estes Termos:{' '}
            <a href="mailto:suporte@reformanextgen.com.br">suporte@reformanextgen.com.br</a>
          </p>
        </div>

        <div className="mt-12 flex items-center gap-4 border-t border-border pt-8 text-sm text-muted-foreground">
          <Link href="/privacidade" className="hover:text-foreground hover:underline">
            Política de Privacidade
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

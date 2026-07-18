// Escolhe um emoji representativo pra um produto a partir da descrição (e, em segundo
// lugar, do caminho na taxonomia mercadológica) — usado nos cards de produtos mais
// impactados (components/admin/estrutura-mercadologica-impacto.tsx) pra dar identidade
// visual rápida sem depender de imagem real do produto (que não existe na planilha).
// Cadeia de fallback, da mais específica pra mais genérica:
//   1. palavra-chave de produto (ex.: "frango" → 🍗)
//   2. ícone da Seção da taxonomia (ex.: Alimentos → 🍽️)
//   3. emoji neutro escolhido de forma determinística (mesmo produto = mesmo emoji sempre)
function normalizar(s: string): string {
  return s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase()
}

// Ordem importa só entre entradas cujas palavras-chave poderiam colidir; termos mais
// específicos vêm antes dos genéricos da mesma família (ex.: "frango" antes de "carne").
const PALAVRAS_CHAVE: [string[], string][] = [
  // Grãos, cereais e mercearia seca
  [['arroz'], '🍚'],
  [['feijao', 'feijão', 'lentilha', 'grao de bico', 'grão de bico'], '🫘'],
  [['milho'], '🌽'],
  [['farinha', 'farinaceo', 'farináceo'], '🌾'],
  [['aveia'], '🌾'],
  [['macarrao', 'macarrão', 'massa', 'espaguete', 'lasanha', 'nhoque'], '🍝'],
  [['acucar', 'açúcar'], '🍬'],
  [['sal ', 'sal,', 'temperos', 'tempero', 'condimento'], '🧂'],
  [['cafe', 'café'], '☕'],
  [['cha ', 'chá'], '🍵'],
  [['chocolate', 'bomboniere', 'achocolatado'], '🍫'],
  [['biscoito', 'bolacha'], '🍪'],
  [['pao', 'pão', 'padaria'], '🍞'],
  [['bolo', 'sobremesa'], '🍰'],
  [['ovo'], '🥚'],
  [['azeite'], '🫒'],
  [['oleo', 'óleo'], '🍶'],
  [['mel'], '🍯'],
  [['vinagre'], '🍶'],
  [['pipoca'], '🍿'],
  [['cereal', 'matinal', 'matinais'], '🥣'],

  // Açougue / proteína
  [['frango', 'ave', 'galinha'], '🍗'],
  [['peixe', 'peixaria', 'salmao', 'salmão', 'tilapia', 'tilápia', 'bacalhau'], '🐟'],
  [['camarao', 'camarão', 'fruto do mar', 'frutos do mar'], '🍤'],
  [['linguica', 'linguiça', 'salsicha', 'embutido'], '🌭'],
  [['bacon'], '🥓'],
  [['presunto', 'frios', 'mortadela', 'friambreria'], '🍖'],
  [['carne', 'bovino', 'bovina', 'bife', 'picanha', 'alcatra', 'açougue', 'acougue'], '🥩'],

  // Laticínios
  [['leite'], '🥛'],
  [['queijo', 'laticinio', 'laticínio'], '🧀'],
  [['iogurte'], '🥣'],
  [['manteiga', 'margarina'], '🧈'],

  // Hortifruti
  [['banana'], '🍌'],
  [['maca ', 'maça', 'maçã'], '🍎'],
  [['laranja', 'citrico', 'cítrico'], '🍊'],
  [['uva'], '🍇'],
  [['morango'], '🍓'],
  [['abacaxi'], '🍍'],
  [['limao', 'limão'], '🍋'],
  [['tomate'], '🍅'],
  [['batata'], '🥔'],
  [['cebola'], '🧅'],
  [['alho'], '🧄'],
  [['cenoura'], '🥕'],
  [['pimentao', 'pimentão', 'pimenta'], '🌶️'],
  [['alface', 'verdura', 'legume', 'hortalica', 'hortaliça'], '🥬'],
  [['hortifruti', 'fruta'], '🍎'],

  // Bebidas
  [['refrigerante', 'coca', 'soda'], '🥤'],
  [['cerveja'], '🍺'],
  [['vinho'], '🍷'],
  [['whisky', 'destilada', 'destilado', 'vodka', 'cachaca', 'cachaça', 'pinga', 'gin', 'rum'], '🥃'],
  [['suco'], '🧃'],
  [['agua', 'água'], '💧'],
  [['energetico', 'energético', 'isotonico', 'isotônico'], '⚡'],

  // Doces / sobremesas
  [['sorvete', 'gelado'], '🍦'],
  [['doce', 'bombom', 'bala'], '🍬'],
  [['pirulito'], '🍭'],
  [['pudim'], '🍮'],
  [['salgadinho'], '🍟'],

  // Higiene / perfumaria
  [['shampoo', 'condicionador'], '🧴'],
  [['sabonete'], '🧼'],
  [['creme dental', 'escova de dente', 'higiene bucal'], '🪥'],
  [['fralda'], '👶'],
  [['absorvente'], '🌸'],
  [['perfume', 'colonia', 'colônia'], '🌺'],
  [['maquiagem', 'batom', 'manicure'], '💄'],
  [['papel higienico', 'papel higiênico'], '🧻'],
  [['barbearia', 'barbeador'], '🪒'],

  // Limpeza
  [['detergente', 'sabao', 'sabão', 'limpeza'], '🧼'],
  [['desinfetante', 'agua sanitaria', 'água sanitária', 'alvejante'], '🧴'],
  [['amaciante', 'lavanderia'], '🧺'],
  [['vassoura', 'rodo', 'esponja'], '🧹'],
  [['inseticida', 'repelente'], '🦟'],

  // Farmácia / saúde
  [['remedio', 'remédio', 'medicamento', 'farmacia', 'farmácia', 'vitamina'], '💊'],
  [['curativo', 'gaze', 'hospitalar'], '🩹'],
  [['seringa', 'agulha'], '💉'],
  [['termometro', 'termômetro', 'equipamento medico', 'equipamento médico'], '🌡️'],

  // Pet / animais
  [['racao', 'ração', 'pet shop', 'veterinari'], '🐾'],
  [['gado', 'boi', 'vaca', 'bovino vivo'], '🐄'],
  [['suino', 'suíno', 'porco'], '🐖'],
  [['galinha viva', 'ave viva'], '🐔'],
  [['animal', 'animais vivos'], '🐾'],

  // Bazar / utilidades
  [['descartavel', 'descartável', 'copo plastico', 'copo plástico'], '🥤'],
  [['papelaria', 'caderno', 'caneta'], '📓'],
  [['brinquedo'], '🧸'],
  [['pilha', 'bateria'], '🔋'],
  [['vela'], '🕯️'],
  [['panela', 'utensilio', 'utensílio', 'inox', 'aluminio', 'alumínio'], '🍳'],
  [['festa'], '🎉'],
  [['joalheria', 'bijuteria', 'bijuteria'], '💍'],
  [['otica', 'ótica', 'oculos', 'óculos'], '👓'],
  [['instrumento musical'], '🎸'],
  [['arma'], '🔫'],
  [['esportivo', 'esporte'], '⚽'],
  [['camping', 'pesca'], '🎣'],
  [['tabacaria', 'cigarro'], '🚬'],
  [['horta', 'jardim'], '🪴'],

  // Vestuário
  [['calcado', 'calçado', 'sapato', 'tenis', 'tênis'], '👟'],
  [['roupa', 'vestuario', 'vestuário', 'camisa', 'calca', 'calça', 'vestido'], '👕'],
  [['cama, mesa', 'cama mesa', 'toalha', 'lencol', 'lençol'], '🛏️'],

  // Eletro
  [['geladeira', 'fogao', 'fogão', 'liquidificador', 'eletrodomestico', 'eletrodoméstico'], '🔌'],
  [['celular', 'eletronico', 'eletrônico', 'televisao', 'televisão', 'tv '], '📱'],

  // Automotivo
  [['combustivel', 'combustível', 'gasolina', 'diesel', 'etanol', 'lubrificante'], '⛽'],
  [['pneu'], '🛞'],
  [['peca automotiva', 'peça automotiva', 'automotivo'], '🔧'],

  // Construção
  [['cimento', 'argamassa'], '🧱'],
  [['madeira'], '🪵'],
  [['tinta'], '🎨'],
  [['ceramica', 'cerâmica', 'azulejo', 'vidro'], '🧱'],
  [['metal', 'tubulacao', 'tubulação', 'cano'], '🔩'],

  // Veículos
  [['caminhao', 'caminhão', 'veiculo comercial', 'veículo comercial'], '🚚'],
  [['motocicleta', 'moto '], '🏍️'],
  [['bicicleta'], '🚲'],
  [['veiculo', 'veículo', 'carro'], '🚗'],

  // Industrial
  [['maquina industrial', 'máquina industrial', 'equipamento industrial'], '⚙️'],
  [['material eletrico', 'material elétrico'], '🔌'],
  [['logistica', 'logística'], '📦'],
  [['agricola', 'agrícola'], '🚜'],
]

// Ícones por Seção (mesma taxonomia de components/admin/estrutura-mercadologica-tree.tsx,
// duplicado aqui como fallback pra não acoplar este util a um componente client) — usados
// quando nenhuma palavra-chave de produto bate, mas ainda sabemos a Seção do produto.
const EMOJI_SECAO: Record<string, string> = {
  'Alimentos': '🍽️',
  'Não Alimentos': '🧴',
  'Apropriações': '🧾',
  'Animais Vivos': '🐾',
  'Material de Construção': '🧱',
  'Automotivo': '🚗',
  'Hospitalar e Médico': '🏥',
  'Veículos': '🚙',
  'Industrial e Equipamentos': '⚙️',
  'Não Classificado': '❔',
}

const EMOJI_NEUTROS = ['📦', '🏷️', '🛒', '✨', '🔸']

function hash(s: string): number {
  let h = 0
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) | 0
  return Math.abs(h)
}

/** Emoji representativo pra um produto — nunca falha, sempre devolve algo determinístico. */
export function emojiProduto(descricao: string | undefined | null, secao?: string | null): string {
  const texto = normalizar(descricao ?? '')
  for (const [palavras, emoji] of PALAVRAS_CHAVE) {
    if (palavras.some(p => texto.includes(p))) return emoji
  }
  if (secao && EMOJI_SECAO[secao]) return EMOJI_SECAO[secao]
  const chave = descricao || secao || ''
  return EMOJI_NEUTROS[hash(chave) % EMOJI_NEUTROS.length]
}

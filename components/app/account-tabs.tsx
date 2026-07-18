'use client'

import type { ReactNode } from 'react'
import { motion } from 'motion/react'
import { User, Building2, ShieldCheck } from 'lucide-react'

import { Tabs, TabsList, TabsTab, TabsIndicator, TabsPanel } from '@/components/ui/tabs'

const TABS = [
  { value: 'perfil', label: 'Perfil', icon: User },
  { value: 'empresa', label: 'Empresa', icon: Building2 },
  { value: 'seguranca', label: 'Segurança', icon: ShieldCheck },
] as const

function PanelContent({ children }: { children: ReactNode }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.35, ease: [0.22, 1, 0.36, 1] }}
    >
      {children}
    </motion.div>
  )
}

export function AccountTabs({
  perfil,
  empresa,
  seguranca,
}: {
  perfil: ReactNode
  empresa: ReactNode
  seguranca: ReactNode
}) {
  return (
    <Tabs defaultValue="perfil">
      <TabsList>
        {TABS.map((tab) => (
          <TabsTab key={tab.value} value={tab.value} className="flex items-center gap-1.5">
            <tab.icon className="h-3.5 w-3.5" />
            {tab.label}
          </TabsTab>
        ))}
        <TabsIndicator />
      </TabsList>

      <TabsPanel value="perfil">
        <PanelContent>{perfil}</PanelContent>
      </TabsPanel>
      <TabsPanel value="empresa">
        <PanelContent>{empresa}</PanelContent>
      </TabsPanel>
      <TabsPanel value="seguranca">
        <PanelContent>{seguranca}</PanelContent>
      </TabsPanel>
    </Tabs>
  )
}

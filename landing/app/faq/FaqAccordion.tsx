'use client';

import { useState } from 'react';
import { Plus } from 'lucide-react';
import s from './faq.module.scss';

interface FaqItem {
  q: string;
  a: React.ReactNode;
}

interface FaqGroupProps {
  title: string;
  items: FaqItem[];
  startIndex: number; // para numerar los ids de aria correctamente
}

export default function FaqAccordion({ groups }: { groups: { title: string; items: FaqItem[] }[] }) {
  const [openId, setOpenId] = useState<string | null>(null);

  const toggle = (id: string) => setOpenId(prev => prev === id ? null : id);

  return (
    <>
      {groups.map((group, gi) => (
        <div key={gi} className={s.group}>
          <p className={s.groupTitle}>{group.title}</p>
          {group.items.map((item, ii) => {
            const id = `faq-${gi}-${ii}`;
            const isOpen = openId === id;
            return (
              <div key={id} className={s.item}>
                <button
                  className={s.question}
                  aria-expanded={isOpen}
                  aria-controls={`${id}-answer`}
                  onClick={() => toggle(id)}
                >
                  {item.q}
                  <span className={s.question__icon} aria-hidden="true">
                    <Plus size={13} strokeWidth={2.5} />
                  </span>
                </button>
                <div
                  id={`${id}-answer`}
                  className={s.answer}
                  // Animación con maxHeight en vez de display:none — screen readers pueden leer igualmente
                  style={{ maxHeight: isOpen ? '600px' : '0px' }}
                  role="region"
                  aria-labelledby={id}
                >
                  <div className={s.answer__inner}>{item.a}</div>
                </div>
              </div>
            );
          })}
        </div>
      ))}
    </>
  );
}

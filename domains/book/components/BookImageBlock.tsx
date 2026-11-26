'use client';

import React, { useEffect, useState } from 'react';
import { Image as ImageIcon } from 'lucide-react';
import { CanvasNodePosition } from '@/domains/knowledge/types';
import { getKnowledgeRepository } from '@/infrastructure/persistence/repositoryFactory';

interface BookImageBlockProps {
  node: CanvasNodePosition;
  isPrintSheet?: boolean;
}

export function BookImageBlock({ node, isPrintSheet = false }: BookImageBlockProps) {
  const [url, setUrl] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    let objectUrl: string | null = null;

    if (!node.blobId) {
      setUrl(null);
      return;
    }

    getKnowledgeRepository()
      .getBlob(node.blobId)
      .then((blob) => {
        if (!active || !blob) return;
        objectUrl = URL.createObjectURL(blob);
        setUrl(objectUrl);
      });

    return () => {
      active = false;
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [node.blobId]);

  return (
    <figure
      className={`kc-book-avoid-break my-4 overflow-hidden rounded-2xl border p-3 ${
        isPrintSheet
          ? 'border-stone-200 bg-stone-50/70'
          : 'border-zinc-800/80 bg-[#161920]'
      }`}
    >
      {url ? (
        <div className="flex justify-center">
          <img
            src={url}
            alt={node.caption || 'Imagem do mapa'}
            className="max-h-[420px] max-w-full rounded-xl object-contain"
          />
        </div>
      ) : (
        <div className="flex h-36 flex-col items-center justify-center gap-1.5 text-xs text-zinc-500">
          <ImageIcon className="h-5 w-5 opacity-60" />
          <span>Imagem indisponível localmente</span>
        </div>
      )}

      {node.caption?.trim() && (
        <figcaption
          className={`mt-2.5 text-center text-xs italic ${
            isPrintSheet ? 'text-stone-600' : 'text-zinc-400'
          }`}
        >
          {node.caption}
        </figcaption>
      )}
    </figure>
  );
}
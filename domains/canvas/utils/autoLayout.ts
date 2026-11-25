import { Edge, Node } from '@xyflow/react';

export type LayoutDirection = 'radial' | 'horizontal' | 'vertical';

interface SubtreeSize {
  w: number;
  h: number;
  childrenW: number;
  childrenH: number;
}

/**
 * Motor matemático multi-eixo (Radial, Horizontal e Vertical)
 * com medição dinâmica de sub-árvores e espaçamento elegante entre ilhas.
 */
export function computeMultiAxisLayout(
  allNodes: Node[],
  allEdges: Edge[],
  type: LayoutDirection = 'horizontal'
): { nodes: Node[]; edges: Edge[] } {
  const cardNodes = allNodes.filter((n) => n.type !== 'group' && !n.hidden);
  if (cardNodes.length === 0) return { nodes: allNodes, edges: allEdges };

  const nodeMap = new Map(cardNodes.map((n) => [n.id, n]));
  const childrenMap: Record<string, string[]> = {};
  const parentMap: Record<string, string> = {};

  cardNodes.forEach((n) => {
    childrenMap[n.id] = [];
  });

  allEdges.forEach((e) => {
    if (e.hidden) return;
    if (nodeMap.has(e.source) && nodeMap.has(e.target) && !parentMap[e.target]) {
      childrenMap[e.source].push(e.target);
      parentMap[e.target] = e.source;
    }
  });

  const roots = cardNodes.filter((n) => !parentMap[n.id]);
  if (roots.length === 0) return { nodes: allNodes, edges: allEdges };

  const subtreeSizes: Record<string, SubtreeSize> = {};
  const gapX = type === 'vertical' ? 90 : 180;
  const gapY = type === 'horizontal' || type === 'radial' ? 60 : 120;
  const MULTI_ROOT_GAP = 260;

  const getSize = (nodeId: string) => {
    const node = nodeMap.get(nodeId);
    const w = Number(node?.measured?.width || node?.style?.width || 320);
    const h = Number(node?.measured?.height || node?.style?.height || 190);
    return { w, h };
  };

  const measure = (nodeId: string, dir: 'horizontal' | 'vertical'): SubtreeSize => {
    const children = childrenMap[nodeId] || [];
    const { w, h } = getSize(nodeId);

    if (children.length === 0) {
      subtreeSizes[nodeId] = { w, h, childrenW: 0, childrenH: 0 };
      return subtreeSizes[nodeId];
    }

    let childrenW = 0;
    let childrenH = 0;
    children.forEach((cid) => {
      const size = measure(cid, dir);
      if (dir === 'horizontal') {
        childrenH += size.h + gapY;
        childrenW = Math.max(childrenW, size.w);
      } else {
        childrenW += size.w + gapX;
        childrenH = Math.max(childrenH, size.h);
      }
    });

    if (dir === 'horizontal') {
      childrenH -= gapY;
      subtreeSizes[nodeId] = { w: w + gapX + childrenW, h: Math.max(h, childrenH), childrenW, childrenH };
    } else {
      childrenW -= gapX;
      subtreeSizes[nodeId] = { w: Math.max(w, childrenW), h: h + gapY + childrenH, childrenW, childrenH };
    }
    return subtreeSizes[nodeId];
  };

  const newPositions: Record<string, { x: number; y: number }> = {};

  const place = (
    nodeId: string,
    cx: number,
    cy: number,
    dir: 'horizontal' | 'vertical',
    align: 'left' | 'right' | 'down'
  ) => {
    const { w, h } = getSize(nodeId);
    newPositions[nodeId] = { x: Math.round(cx - w / 2), y: Math.round(cy - h / 2) };

    const children = childrenMap[nodeId] || [];
    if (children.length === 0) return;

    const size = subtreeSizes[nodeId];

    if (dir === 'horizontal') {
      let currentY = cy - size.childrenH / 2;
      children.forEach((cid) => {
        const childSize = subtreeSizes[cid];
        const childCy = currentY + childSize.h / 2;
        const { w: actualChildW } = getSize(cid);
        const childCx =
          align === 'right'
            ? cx + w / 2 + gapX + actualChildW / 2
            : cx - w / 2 - gapX - actualChildW / 2;
        place(cid, childCx, childCy, dir, align);
        currentY += childSize.h + gapY;
      });
    } else {
      let currentX = cx - size.childrenW / 2;
      children.forEach((cid) => {
        const childSize = subtreeSizes[cid];
        const childCx = currentX + childSize.w / 2;
        const { h: actualChildH } = getSize(cid);
        const childCy = cy + h / 2 + gapY + actualChildH / 2;
        place(cid, childCx, childCy, dir, align);
        currentX += childSize.w + gapX;
      });
    }
  };

  let currentOffsetX = 120;
  let currentOffsetY = 120;

  roots.forEach((root) => {
    if (type === 'horizontal') {
      measure(root.id, 'horizontal');
      const treeHeight = subtreeSizes[root.id].h;
      place(root.id, currentOffsetX, currentOffsetY + treeHeight / 2, 'horizontal', 'right');
      currentOffsetY += treeHeight + MULTI_ROOT_GAP;
    } else if (type === 'vertical') {
      measure(root.id, 'vertical');
      const treeWidth = subtreeSizes[root.id].w;
      place(root.id, currentOffsetX + treeWidth / 2, currentOffsetY, 'vertical', 'down');
      currentOffsetX += treeWidth + MULTI_ROOT_GAP;
    } else {
      const children = childrenMap[root.id] || [];
      const rightChildren = children.filter((_, i) => i % 2 === 0);
      const leftChildren = children.filter((_, i) => i % 2 !== 0);

      childrenMap[root.id] = rightChildren;
      measure(root.id, 'horizontal');
      const hRight = subtreeSizes[root.id].h;

      childrenMap[root.id] = leftChildren;
      measure(root.id, 'horizontal');
      const hLeft = subtreeSizes[root.id].h;

      const maxTreeHeight = Math.max(hRight, hLeft);
      const cy = currentOffsetY + maxTreeHeight / 2;

      childrenMap[root.id] = rightChildren;
      measure(root.id, 'horizontal');
      place(root.id, currentOffsetX + 400, cy, 'horizontal', 'right');
      const rightPos = { ...newPositions };

      childrenMap[root.id] = leftChildren;
      measure(root.id, 'horizontal');
      place(root.id, currentOffsetX + 400, cy, 'horizontal', 'left');

      Object.assign(newPositions, rightPos);
      childrenMap[root.id] = children;
      currentOffsetY += maxTreeHeight + MULTI_ROOT_GAP;
    }
  });

  const updatedNodes = allNodes.map((n) =>
    newPositions[n.id] ? { ...n, position: newPositions[n.id] } : n
  );

  const updatedEdges = allEdges.map((e) => {
    const sourcePos = newPositions[e.source];
    const targetPos = newPositions[e.target];
    if (!sourcePos || !targetPos) return e;

    let sHandle = e.sourceHandle;
    let tHandle = e.targetHandle;

    if (type === 'vertical') {
      sHandle = 's-bottom';
      tHandle = 't-top';
    } else if (type === 'horizontal') {
      sHandle = 's-right';
      tHandle = 't-left';
    } else {
      if (targetPos.x >= sourcePos.x) {
        sHandle = 's-right';
        tHandle = 't-left';
      } else {
        sHandle = 's-left';
        tHandle = 't-right';
      }
    }
    return { ...e, sourceHandle: sHandle, targetHandle: tHandle };
  });

  return { nodes: updatedNodes, edges: updatedEdges };
}
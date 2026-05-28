import type { ExecutionGraph } from '@aifr/graph-builder';
import type { AttributionSummary } from './types.js';

export function calculateAttribution(graph: ExecutionGraph): AttributionSummary {
  const diffNodes = graph.nodes.filter(n => n.type === 'diff' && n.metadata.isBaseline !== true);
  const totalDiffs = diffNodes.length;

  const causedByEdges = graph.edges.filter(e => e.type === 'caused_by');
  const diffsWithAttribution = new Set<string>();

  let high = 0;
  let medium = 0;
  let low = 0;

  for (const diff of diffNodes) {
    const edgesToDiff = causedByEdges.filter(e => e.to === diff.id);
    if (edgesToDiff.length > 0) {
      diffsWithAttribution.add(diff.id);
      const bestConf = getBestConfidence(edgesToDiff.map(e => e.confidence));
      if (bestConf === 'high') high++;
      else if (bestConf === 'medium') medium++;
      else low++;
    }
  }

  return {
    totalDiffs,
    attributed: diffsWithAttribution.size,
    unattributed: totalDiffs - diffsWithAttribution.size,
    byConfidence: { high, medium, low },
  };
}

function getBestConfidence(confidences: Array<'high' | 'medium' | 'low'>): 'high' | 'medium' | 'low' {
  if (confidences.includes('high')) return 'high';
  if (confidences.includes('medium')) return 'medium';
  return 'low';
}

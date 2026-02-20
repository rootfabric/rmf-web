import type { BuildingMap, GraphNode } from 'api-client';

const DEFAULT_PICKUP_POINT_PARAM_NAME = 'pickup_dispenser';
const DEFAULT_DROPOFF_POINT_PARAM_NAME = 'dropoff_ingestor';
const DEFAULT_CLEANING_ZONE_PARAM_NAME = 'is_cleaning_zone';
const DEFAULT_TRUE_VALUES = new Set(['1', 'true', 'yes', 'on', 'pallet']);

export interface Place {
  level: string;
  vertex: GraphNode;
  pickupHandler?: string;
  dropoffHandler?: string;
  cleaningZone?: boolean;
}

export interface PalletFlowPoint {
  approachWaypoint: string;
  retreatWaypoint: string;
}

function isTruthyString(value: string): boolean {
  return DEFAULT_TRUE_VALUES.has((value || '').trim().toLowerCase());
}

function isTruthyParamValue(param: GraphNode['params'][number]): boolean {
  return Boolean(param.value_bool) || isTruthyString(param.value_string) || param.value_int === 1;
}

function isPalletStorageVertex(vertex: GraphNode): boolean {
  const param = vertex.params.find((p) => p.name === DEFAULT_PICKUP_POINT_PARAM_NAME);
  if (!param) {
    return false;
  }

  // We only treat boolean-like pickup_dispenser values as pallet markers.
  // Non-boolean strings are likely delivery handler names and should be ignored.
  return Boolean(param.value_bool) || isTruthyString(param.value_string);
}

function computeNeighborAdjacency(
  level: BuildingMap['levels'][number],
  graphIdx: number,
): Set<number>[] {
  const graph = level.nav_graphs[graphIdx];
  const adjacency = graph.vertices.map(() => new Set<number>());

  for (const edge of graph.edges) {
    if (edge.v1_idx >= graph.vertices.length || edge.v2_idx >= graph.vertices.length) {
      continue;
    }
    adjacency[edge.v1_idx].add(edge.v2_idx);
    adjacency[edge.v2_idx].add(edge.v1_idx);
  }

  return adjacency;
}

function distanceSquared(v1: GraphNode, v2: GraphNode): number {
  const dx = (v1.x ?? 0) - (v2.x ?? 0);
  const dy = (v1.y ?? 0) - (v2.y ?? 0);
  return dx * dx + dy * dy;
}

export function getPalletFlowPoints(buildingMap: BuildingMap): Record<string, PalletFlowPoint> {
  const result: Record<string, PalletFlowPoint> = {};

  for (const level of buildingMap.levels) {
    level.nav_graphs.forEach((graph, graphIdx) => {
      const adjacency = computeNeighborAdjacency(level, graphIdx);

      graph.vertices.forEach((vertex, vertexIdx) => {
        const parkingName = (vertex.name || '').trim();
        if (!parkingName || !isPalletStorageVertex(vertex)) {
          return;
        }

        const namedNeighborIdx = Array.from(adjacency[vertexIdx]).filter((nIdx) => {
          const nName = (graph.vertices[nIdx]?.name || '').trim();
          return nName.length > 0;
        });
        if (namedNeighborIdx.length === 0) {
          return;
        }

        const nonPalletNeighbors = namedNeighborIdx.filter(
          (nIdx) => !isPalletStorageVertex(graph.vertices[nIdx]),
        );
        const candidates = nonPalletNeighbors.length > 0 ? nonPalletNeighbors : namedNeighborIdx;

        candidates.sort((aIdx, bIdx) => {
          const distA = distanceSquared(vertex, graph.vertices[aIdx]);
          const distB = distanceSquared(vertex, graph.vertices[bIdx]);
          if (distA !== distB) {
            return distA - distB;
          }
          const nameA = (graph.vertices[aIdx].name || '').trim();
          const nameB = (graph.vertices[bIdx].name || '').trim();
          return nameA.localeCompare(nameB);
        });

        const approachName = (graph.vertices[candidates[0]].name || '').trim();
        if (!approachName) {
          return;
        }

        result[parkingName] = {
          approachWaypoint: approachName,
          retreatWaypoint: approachName,
        };
      });
    });
  }

  return result;
}

export function getPlaces(buildingMap: BuildingMap): Place[] {
  const places = new Map<string, Place>();
  for (const level of buildingMap.levels) {
    for (const graphs of level.nav_graphs) {
      for (const vertex of graphs.vertices) {
        if (!vertex.name) {
          continue;
        }
        const place: Place = { level: level.name, vertex };
        for (const p of vertex.params) {
          if (p.name === DEFAULT_PICKUP_POINT_PARAM_NAME) {
            // Only non-boolean values are considered delivery handlers.
            if (p.value_string.length > 0 && !isTruthyParamValue(p)) {
              place.pickupHandler = p.value_string;
            }
          }
          if (p.name === DEFAULT_DROPOFF_POINT_PARAM_NAME) {
            place.dropoffHandler = p.value_string;
          }
          if (p.name === DEFAULT_CLEANING_ZONE_PARAM_NAME) {
            place.cleaningZone = true;
          }
        }
        places.set(vertex.name, place);
      }
    }
  }
  return Array.from(places.values());
}

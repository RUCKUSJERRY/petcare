import type { RagChunk, Scored } from './types'
import { buildLexicalIndex, searchLexical, type LexicalIndex } from './lexical'
import { searchVector, type EmbeddedChunk } from './vector'
import { reciprocalRankFusion } from './fuse'
import { buildCorpus } from './corpus'
import { chunkCorpus, type ChunkOptions } from './chunk'

/**
 * RAG 인덱스 — 청크 집합 위에서 lexical / vector / hybrid 검색을 제공한다.
 *
 * lexical 은 임베딩 없이 바로 동작한다. vector/hybrid 는 임베딩을 주입(setEmbeddings)해야 한다
 * (임베딩 생성·질의 임베딩은 모델 호출이라 이 순수 코어 밖에서 한다). 하이브리드는 두 랭킹을 RRF 로 합친다.
 */
export class RagIndex {
  readonly chunks: RagChunk[]
  private lex: LexicalIndex
  private embeddings = new Map<string, number[]>()

  constructor(chunks: RagChunk[]) {
    this.chunks = chunks
    this.lex = buildLexicalIndex(chunks)
  }

  /** 청크 id > 임베딩 벡터. (오프라인 코어에선 비어 있고, 모델로 채워 넣는다.) */
  setEmbeddings(map: Map<string, number[]>): void {
    this.embeddings = map
  }

  private embeddedChunks(): EmbeddedChunk[] {
    const out: EmbeddedChunk[] = []
    for (const c of this.chunks) {
      const e = this.embeddings.get(c.id)
      if (e) out.push({ chunk: c, embedding: e })
    }
    return out
  }

  searchLexical(query: string, topK = 5): Scored<RagChunk>[] {
    return searchLexical(this.lex, query, topK)
  }

  searchVector(queryEmbedding: number[], topK = 5): Scored<RagChunk>[] {
    return searchVector(this.embeddedChunks(), queryEmbedding, topK)
  }

  /**
   * 하이브리드: lexical + vector 를 RRF 로 합친다. 질의 임베딩이 없거나 임베딩이 안 채워졌으면
   * lexical 단독으로 폴백한다(의미 축이 없으면 정확 일치만으로라도 답한다).
   */
  searchHybrid(query: string, queryEmbedding: number[] | null, topK = 5): Scored<RagChunk>[] {
    const lexical = this.searchLexical(query, Math.max(topK, 10))
    if (!queryEmbedding || this.embeddings.size === 0) return lexical.slice(0, topK)
    const vector = this.searchVector(queryEmbedding, Math.max(topK, 10))
    return reciprocalRankFusion([lexical, vector], c => c.id, topK)
  }
}

/** 앱 코퍼스로 RagIndex 를 만든다(청킹 포함). */
export function buildRagIndex(opts: ChunkOptions = {}): RagIndex {
  return new RagIndex(chunkCorpus(buildCorpus(), opts))
}

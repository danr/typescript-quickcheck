
export class Generator {
  constructor(
    private readonly seed: number,
    private readonly size: number
    // collect information and information from suchThat
  ) { }
  public label(x: string) {}
  public int(): number { throw 'todo' }
  /** returns a function that returns a copy of this generator */
  public freeze(): () => Generator { throw 'todo' }
}

// keep calling yourself
// todo: return a rose-tree
function half(x: number): number[] {
  if (x > 1 && x % 2 == 1) {
    return [x-1]
  } else if (x < -1 && x % 2 == 1) {
    return [x+1]
  } else if (x > 1 || x < -1) {
    return [x/2]
  } else if (Math.abs(x) > 0.0001) {
    return [0]
  } else {
    return []
  }
}


// these should exist both as returning Arbitrary, and as members on each Generator

// numbers
export function bounded(upper_exclusive: number): Arbitrary<number> {
  return range(0, upper_exclusive)
}
export function range(lo: number, hi: number): Arbitrary<number> {
  return new Arbitrary(
    g => Generated(g.int() % (hi - lo) + lo, half)
  )
}
export function nat(): Arbitrary<number> {
  return new Arbitrary(g => Generated(Math.abs(g.int()), half))
}
export function uint(): Arbitrary<number> { return this.nat() }

// characters
export function alphabet(s: string): Arbitrary<string> {
  return new Arbitrary(g => Generated(s[g.int() % s.length]))
}
export function alpha(): Arbitrary<string> { return str_oneof(lower(), upper()) }
export function lower(): Arbitrary<string> { return alphabet('abcdefghijklmnopqrstuvwxyz') }
export function upper(): Arbitrary<string> { return alphabet('ABCDEFGHIJKLMNOPQRSTUVWXYZ') }
export function digit(): Arbitrary<string> { throw 'todo' }
export function alphaDigit(): Arbitrary<string> { throw 'todo' }
export function whitespace(): Arbitrary<string> { throw 'todo' }
export function printable(): Arbitrary<string> { throw 'todo' }

// strings
export function stringof(s: Arbitrary<string>): Arbitrary<string> { throw 'todo' }
export function nestringof(s: Arbitrary<string>): Arbitrary<string> { throw 'todo' }
export function str_replicate(n: number, s: Arbitrary<string>): Arbitrary<string> { throw 'todo' }

// arrays. shrinks should be shrink by one element?
export function arrayof<A>(g: Arbitrary<A>): Arbitrary<A[]> { throw 'todo' }
export function nearrayof<A>(g: Arbitrary<A>): Arbitrary<A[]> { throw 'todo' }
export function replicate<A>(n: number, g: Arbitrary<A>): Arbitrary<A[]> { throw 'todo' }

export function choose<A>(xs: A[]): Arbitrary<A> { throw 'todo' }
export function always<A>(a: A): Arbitrary<A> { return new Arbitrary(g => Generated(a))}

// does this shrink?
export function frequency<A>(table: [number, Arbitrary<A>][]): Arbitrary<A> { throw 'todo' }

// should instead try to only shrink one of them at a time
export function cross<A, B>(xs: A[], ys: B[]): Arbitrary<[A, B][]> {
  const m = xs.length
  const n = ys.length
  return replicate(Math.max(m, n), choose(xs).then(x => choose(ys).then(y => always([x, y] as [A, B]))))
}

// shrink along one axis at a time
export function alongs(orig: any[], xss: any[][]): any[][] {
  flatMap
  xss.map((xs, i) => {
    update(xss, i, xs)
  })
}

// products
export function record<Ks extends keyof S, S>(s: {[K in Ks]: Arbitrary<S[K]>}): Arbitrary<S> {
  const ks = Object.keys(s) as Ks[]
  return new Arbitrary(g => {
    const vs = {} as {[K in Ks]: Generated<S[K]>}
    ks.forEach((k: Ks) => vs[k] = s[k].generate(g))
    const v = {} as S
    ks.forEach((k: Ks) => v[k] = vs[k].value)
    return Generated(v, () => cross(va.shrinks(), vb.shrinks()).generate(g).value)
  })
  throw 'todo'
}
export function pair<A, B>(a: Arbitrary<A>, b: Arbitrary<B>): Arbitrary<[A, B]> {
  return new Arbitrary(g => {
    const va = a.generate(g)
    const vb = b.generate(g)
    return Generated([va.value, vb.value] as [A, B], () => cross(va.shrinks(), vb.shrinks()).generate(g).value)
  })
}

// sums
export function oneof<A>(...these: Arbitrary<A>[]): Arbitrary<A> {
  return bounded(these.length).then(i => these[i])
}
export type Tagged<A, B> = {tag: 'left', value: A} | {tag: 'right', value: B}
export function untag<A, B>(ab: Tagged<A, B>): A | B {
  return ab.value
}
export function left<A, B>(value: A): Tagged<A, B> {
  return {tag: 'left', value}
}
export function right<A, B>(value: B): Tagged<A, B> {
  return {tag: 'right', value}
}
export function tagged<A, B>(a: Arbitrary<A>, b: Arbitrary<B>): Arbitrary<Tagged<A, B>> {
  return bounded(2).then(i => {
    if (i == 0) {
      return a.map(v => left(v))
    } else {
      return b.map(v => right(v))
    }
  })
}
export function either<A, B>(a: Arbitrary<A>, b: Arbitrary<B>): Arbitrary<A | B> {
  return tagged(a, b).map(untag)
}

export interface Generated<A> {
  value: A,
  shrinks: () => A[], // return rose tree here?
  show: () => string,
}

export function Generated<A>(
  value: A,
  shrinks: (a: A) => A[] = () => [],
  show: (a: A) => string = a => JSON.stringify(a),
): Generated<A> {
  return {value, show: () => show(value), shrinks: () => shrinks(value)}
}

export class Arbitrary<A> {
  public constructor(
    // should be private and only called from quickCheck function and from sample function
    public readonly generate: (g: Generator) => Generated<A>,
  )
  { }

  /** Pure map. Runs this function on each shrunk element too,
      starting from the random same seed

    arb_graph.map(
      (graph, g) =>
        const N = G.size(g)
        const from = g.bound(N-1)
        const to = g.range(from, N)
        return {graph, from, to}

  */
  public map<B>(f: (a: A, g: Generator) => B): Arbitrary<B> {
    return new Arbitrary(g => {
      const {value, shrinks} = this.generate(g)
      const recreate = g.freeze()
      return Generated(f(value, recreate()), () => shrinks().map(a => f(a, recreate())))
    })
  }

  /** Impure map, shrinks as the generator returned here */
  public then<B>(f: (a: A, g: Generator) => Arbitrary<B>): Arbitrary<B> {
    throw 'todo'
  }

  public merge<B>(other: Arbitrary<B>): Arbitrary<A & B> {
    throw 'todo'
  }

  public iso<B>(f: (s: A) => B, g: (t: B) => A): Arbitrary<B> {
    throw 'todo'
  }

  public tap(k: (a: A) => string | void) {
    throw 'todo'
  }

  public suchThat(p: (a: A) => boolean): Arbitrary<A> {
    throw 'todo'
  }
}


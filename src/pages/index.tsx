// TODO: Here should be the homepage.

import type { InferGetStaticPropsType } from 'next'

export default function Index({
  repo,
}: InferGetStaticPropsType<typeof getStaticProps>) {
  return (
    <>
      Homepage
    </>
  )
}

export const getStaticProps = (async () => {
  const res = await fetch('https://api.github.com/repos/vercel/next.js')
  const repo = await res.json()
  return {
    props: { repo },
  }
})

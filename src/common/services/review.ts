import { IClientSideReview } from "@/models/ClientSideReview";

export const postReviewClientSide = (review: IClientSideReview): Promise<{ done: boolean }> => {
  return fetch('https://www.radio-crestin.com/api/v1/review', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(review)
  }).then((res) => res.json()).catch(e => {
    console.error(e);
    return { done: false }
  });
};

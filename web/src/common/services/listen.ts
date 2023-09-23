import { IClientSideListeningEvent } from "@/models/ClientSideListeningEvent";

export const trackListenClientSide = (listeningEvent: IClientSideListeningEvent): Promise<{ done: boolean }> => {
  return fetch('/api/v1/listen', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(listeningEvent)
  }).then((res) => res.json()).catch(e => {
    console.error(e);
    return { done: false }
  });
};

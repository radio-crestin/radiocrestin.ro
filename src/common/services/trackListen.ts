import { CONSTANTS } from "@/constants/constants";

const query = `mutation InsertListeningEvent(
  $station_id: Int!
) {
  insert_listening_events(objects: {station_id: $station_id}) {
    affected_rows
  }
}`;

export const trackListen = (listeningEvent: {
  station_id: bigint;
}): Promise<{ done: boolean }> => {
  const endpoint = CONSTANTS.GRAPHQL_ENDPOINT;

  const options = {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      operationName: "InsertListeningEvent",
      query: query,
      variables: listeningEvent,
    }),
  };

  return fetch(endpoint, options)
    .then((response) => {
      if (!response.ok) {
        throw new Error("Network response was not ok");
      }
      return response.json();
    })
    .then((data) => {
      if (!data?.data) {
        throw new Error(`Invalid response: ${JSON.stringify(data)}`);
      }
      return {
        done: typeof data.data.affected_rows !== "undefined",
      };
    });
};

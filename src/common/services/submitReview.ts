import { CONSTANTS } from "@/constants/constants";
import { Bugsnag } from "@/utils/bugsnag";
import { IReview } from "@/models/Station";

interface SubmitReviewInput {
  station_id: number;
  message: string;
  stars: number;
  user_identifier: string;
}

interface SubmitReviewSuccessResponse {
  __typename: "SubmitReviewResponse";
  created: boolean;
  message: string;
  success: boolean;
  review: IReview;
}

interface SubmitReviewErrorResponse {
  __typename: "OperationInfo";
  messages: {
    code: string;
    field: string;
    kind: string;
    message: string;
  }[];
}

type SubmitReviewResponse = SubmitReviewSuccessResponse | SubmitReviewErrorResponse;

const SUBMIT_REVIEW_MUTATION = `
mutation SubmitReview($message: String = "", $stars: Int = 5, $station_id: Int = 0, $user_identifier: String = "") {
  submit_review(
    input: {station_id: $station_id, message: $message, stars: $stars, user_identifier: $user_identifier}
  ) {
    ... on SubmitReviewResponse {
      __typename
      created
      message
      success
      review {
        id
        message
        stars
        created_at
        station_id
        updated_at
        user_identifier
        verified
      }
    }
    ... on OperationInfo {
      __typename
      messages {
        code
        field
        kind
        message
      }
    }
  }
}
`;

export const submitReview = async (
  input: SubmitReviewInput
): Promise<{ success: boolean; data?: SubmitReviewResponse; error?: string }> => {
  try {
    const response = await fetch(CONSTANTS.GRAPHQL_ENDPOINT, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Accept: "application/json",
      },
      body: JSON.stringify({
        query: SUBMIT_REVIEW_MUTATION,
        variables: {
          station_id: input.station_id,
          message: input.message,
          stars: input.stars,
          user_identifier: input.user_identifier,
        },
      }),
    });

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    const result = await response.json();

    if (result.errors) {
      return {
        success: false,
        error: result.errors[0]?.message || "A apărut o eroare la trimiterea recenziei",
      };
    }

    const submitReviewData = result.data?.submit_review as SubmitReviewResponse | undefined;

    if (!submitReviewData) {
      return {
        success: false,
        error: "A apărut o eroare la trimiterea recenziei",
      };
    }

    if (submitReviewData.__typename === "OperationInfo") {
      return {
        success: false,
        error: submitReviewData.messages[0]?.message || "A apărut o eroare la trimiterea recenziei",
      };
    }

    return {
      success: true,
      data: submitReviewData,
    };
  } catch (error) {
    Bugsnag.notify(
      new Error("Submit review error: " + JSON.stringify(error, null, 2))
    );

    return {
      success: false,
      error: "A apărut o eroare la trimiterea recenziei. Vă rugăm încercați din nou.",
    };
  }
};

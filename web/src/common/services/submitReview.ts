import { CONSTANTS } from "@/constants/constants";
import { captureException } from "@/utils/posthog";
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

export const submitReview = async (
  input: SubmitReviewInput
): Promise<{ success: boolean; data?: SubmitReviewResponse; error?: string }> => {
  try {
    const response = await fetch(CONSTANTS.REVIEWS_API_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Accept: "application/json",
      },
      body: JSON.stringify({
        station_id: input.station_id,
        message: input.message,
        stars: input.stars,
        user_identifier: input.user_identifier,
      }),
    });

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    const result = await response.json();

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
    captureException(error, "Submit review error");

    return {
      success: false,
      error: "A apărut o eroare la trimiterea recenziei. Vă rugăm încercați din nou.",
    };
  }
};

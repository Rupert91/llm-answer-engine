// 1. Define the 'LLMResponseComponentProps' interface with properties for 'llmResponse', 'currentLlmResponse', and 'index'
interface LLMResponseComponentProps {
  llmResponse: string;
  currentLlmResponse: string;
  llmResponseEnd:boolean;
  index: number;
}

// 2. Import the 'Markdown' component from 'react-markdown'
import Markdown from "react-markdown";
import NewsList from "./NewsList";

// 3. Define the 'StreamingComponent' functional component that renders the 'currentLlmResponse'
const StreamingComponent = ({
  currentLlmResponse,
}: {

  currentLlmResponse: string;
}) => {
  return (
    <>
      {currentLlmResponse && (
        <div className="dark:bg-slate-800 bg-white shadow-lg rounded-lg p-4 mt-4">
          <div className="flex items-center">
            <h2 className="text-lg font-semibold flex-grow dark:text-white text-black">
              Answer
            </h2>
            <img src="./groq.png" alt="groq logo" className="w-6 h-6" />
          </div>
          <div className="dark:text-gray-300 text-gray-800">
            {currentLlmResponse}
          </div>
        </div>
      )}
    </>
  );
};

// 4. Define the 'LLMResponseComponent' functional component that takes 'llmResponse', 'currentLlmResponse', and 'index' as props
const LLMResponseComponent = ({
  llmResponse,
  currentLlmResponse,
  llmResponseEnd,
  index,
}: LLMResponseComponentProps) => {
  console.log("llmResponse", llmResponse);
  console.log("llmResponseEnd", llmResponseEnd);
  // 5. Check if 'llmResponse' is not empty
  const hasLlmResponse = llmResponse && llmResponse.trim().length > 0;

  const newLlmResponse: any =  llmResponse

  if (Array.isArray(newLlmResponse)) {
    console.log("data是一个数组");
  } else {
    console.log("data不是一个数组");
  }

console.log("newLlmResponse", newLlmResponse);
  return (
    <>
      {hasLlmResponse ? (
        // 6. If 'llmResponse' is not empty, render a div with the 'Markdown' component
        <div className="dark:bg-slate-800 bg-white shadow-lg rounded-lg p-4 mt-4">
          <div className="flex items-center">
            <h2 className="text-lg font-semibold flex-grow dark:text-white text-black">
              Answer
            </h2>
            <img
              src="./mistral.png"
              alt="mistral logo"
              className="w-6 h-6 mr-2"
            />
            <img src="./groq.png" alt="groq logo" className="w-6 h-6" />
          </div>
          <div className="dark:text-gray-300 text-gray-800">
            <Markdown>{llmResponse}</Markdown>
            {/* {llmResponseEnd && newLlmResponse.map((item: any) => {
              return <div key={item.title}>{item.title}</div>;
            })} */}
        
            {/* {newLlmResponse.map((item: any) => {
              return <div key={item.title}>{item.title}</div>;
            })} */}
          </div>
        </div>
      ) : (
        // 7. If 'llmResponse' is empty, render the 'StreamingComponent' with 'currentLlmResponse'
        <StreamingComponent currentLlmResponse={currentLlmResponse} />
      )}
    </>
  );
};

export default LLMResponseComponent;

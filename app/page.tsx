'use client';
// 1. Import Dependencies
import { FormEvent, useEffect, useRef, useState, useCallback } from 'react';
import { useActions, readStreamableValue } from 'ai/rsc';
import { type AI } from './action';
import { ChatScrollAnchor } from '@/lib/hooks/chat-scroll-anchor';
import Textarea from 'react-textarea-autosize';
import { useEnterSubmit } from '@/lib/hooks/use-enter-submit';
import { Tooltip, TooltipContent, TooltipTrigger, } from '@/components/ui/tooltip';
import { IconArrowElbow } from '@/components/ui/icons';
import { Button } from '@/components/ui/button';
// Custom components 
import SearchResultsComponent from '@/components/answer/SearchResultsComponent';
import UserMessageComponent from '@/components/answer/UserMessageComponent';
import LLMResponseComponent from '@/components/answer/LLMResponseComponent';
import ImagesComponent from '@/components/answer/ImagesComponent';
import VideosComponent from '@/components/answer/VideosComponent';
import FollowUpComponent from '@/components/answer/FollowUpComponent';
// 2. Set up types
interface SearchResult {
  favicon: string;
  link: string;
  title: string;
}
interface Message {
  id: number;
  type: string;
  content: string;
  userMessage: string;
  images: Image[];
  videos: Video[];
  FinalResult?: FinalResult[];
  isStreaming: boolean;
  searchResults?: SearchResult[];
  numResults:any;
  processedQuery:any;
  mediaType:any;
}
interface StreamMessage {
  searchResults?: any;
  userMessage?: string;
  llmResponse?: string;
  llmResponseEnd?: boolean;
  images?: any;
  videos?: any;
  FinalResult?: any;
  numResults?:any;
  processedQuery:any;
  mediaType:any;
}
interface Image {
  link: string;
}
interface Video {
  link: string;
  imageUrl: string;
}
interface FinalResult {
  title: string;
  link: string;
  snippet: string;
  position: number;
};
export default function Page() {
  const [isInputPage, setIsInputPage] = useState(true);

  // 3. Set up action that will be used to stream all the messages
  const { myAction } = useActions<typeof AI>();
  // 4. Set up form submission handling
  const { formRef, onKeyDown } = useEnterSubmit();
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const [inputValue, setInputValue] = useState('');
  // 5. Set up state for the messages
  const [messages, setMessages] = useState<Message[]>([]);
  // 6. Set up state for the CURRENT LLM response (for displaying in the UI while streaming)
  const [currentLlmResponse, setCurrentLlmResponse] = useState('');
  // 7. Set up handler for when the user clicks on the follow up button
  const handleFollowUpClick = useCallback(async (question: string) => {
    setCurrentLlmResponse('');
    await handleUserMessageSubmission(question);
  }, []);
  // 8. For the form submission, we need to set up a handler that will be called when the user submits the form
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === '/') {
        if (
          e.target &&
          ['INPUT', 'TEXTAREA'].includes((e.target as HTMLElement).nodeName)
        ) {
          return;
        }
        e.preventDefault();
        e.stopPropagation();
        if (inputRef?.current) {
          inputRef.current.focus();
        }
      }
    };
    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [inputRef]);
  // 9. Set up handler for when a submission is made, which will call the myAction function
  const handleSubmit = async (message: string) => {
    if (!message) return;
    await handleUserMessageSubmission(message);
  };
  const handleFormSubmit = async (e: React.FormEvent<HTMLFormElement>): Promise<void> => {
    e.preventDefault();
    const messageToSend = inputValue.trim();
    if (!messageToSend) return;
    setInputValue('');
    await handleSubmit(messageToSend);
  };
  const handleUserMessageSubmission = async (userMessage: string): Promise<void> => {
    console.log('handleUserMessageSubmission', userMessage);
    const newMessageId = Date.now();
    const newMessage = {
      id: newMessageId,
      type: 'userMessage',
      userMessage: userMessage,
      content: '',
      images: [],
      videos: [],
      FinalResult: [] as FinalResult[],  // 设置为 FinalResult 数组
      isStreaming: true,
      numResults:'',
      searchResults: [] as SearchResult[],
      processedQuery:[],
      mediaType: [],
    };
    setMessages(prevMessages => [...prevMessages, newMessage]);
    let lastAppendedResponse = "";
    try {
      const streamableValue = await myAction(userMessage);
      let llmResponseString = "";
      for await (const message of readStreamableValue(streamableValue)) {
        const typedMessage = message as StreamMessage;
        setMessages((prevMessages) => {
          const messagesCopy = [...prevMessages];
          const messageIndex = messagesCopy.findIndex(msg => msg.id === newMessageId);
          if (messageIndex !== -1) {
            const currentMessage = messagesCopy[messageIndex];
            if (typedMessage.llmResponse && typedMessage.llmResponse !== lastAppendedResponse) {
              currentMessage.content += typedMessage.llmResponse;
              lastAppendedResponse = typedMessage.llmResponse; // Update last appended response
            }
            if (typedMessage.llmResponseEnd) {
              currentMessage.isStreaming = false;
            }
            if (typedMessage.processedQuery) {
              currentMessage.processedQuery = typedMessage.processedQuery;
            }
            if (typedMessage.searchResults) {
              currentMessage.searchResults = typedMessage.searchResults;
            }
            if (typedMessage.images) {
              currentMessage.images = [...typedMessage.images];
            }
            if (typedMessage.videos) {
              currentMessage.videos = [...typedMessage.videos];
            }
            if (typedMessage.FinalResult) {
              currentMessage.FinalResult = typedMessage.FinalResult;
            }
            if (typedMessage.numResults) {
              currentMessage.numResults = typedMessage.numResults;
            }
            if (typedMessage.mediaType) {
              currentMessage.mediaType = typedMessage.mediaType;
            }
          }
          return messagesCopy;
        });
        if (typedMessage.llmResponse) {
          llmResponseString += typedMessage.llmResponse;
          setCurrentLlmResponse(llmResponseString);
        }
      }
    } catch (error) {
      console.error("Error streaming data for user message:", error);
    }
  };
  return (
    <div>
      {messages.length > 0 && (
        <div className="flex flex-col">
          {messages.map((message, index) => (
            <div key={`message-${index}`} className="flex flex-col md:flex-row">
              <div className="w-full md:w-3/4 md:pr-2">
                {message.searchResults && (
                  <SearchResultsComponent key={`searchResults-${index}`} searchResults={message.searchResults} />
                )}
                {message.type === 'userMessage' && <UserMessageComponent message={message.userMessage} />}
                <LLMResponseComponent
                  llmResponse={message.content}
                  currentLlmResponse={currentLlmResponse}
                  index={index}
                  key={`llm-response-${index}`}
                />
        {message.FinalResult && (
            <div className="flex flex-col">
                <h2>Showing {message.numResults} Results</h2> {/* 显示结果数量 */}
                <ul>
                    {message.FinalResult.map((result, index) => (
                        <li key={index} className="mb-2">
                            <h4>{result.title}</h4> {/* 假设每个结果有标题 */}
                            <p>{result.snippet}</p> {/* 显示结果摘要 */}
                            <a href={result.link} target="_blank" rel="noopener noreferrer">Read More</a> {/* 链接到更多内容 */}
                            <button onClick={() => handleFollowUpClick(result.link)}>Follow Up</button> {/* 处理点击事件 */}
                        </li>
                    ))}
                </ul>
            </div>
        )}
       <div> showing {message.mediaType}</div>
              </div>
              <div className="w-full md:w-1/4 lg:pl-2">
                {message.videos && <VideosComponent key={`videos-${index}`} videos={message.videos} />}
                {message.images && <ImagesComponent key={`images-${index}`} images={message.images} />}
              </div>
            </div>
          ))}
        </div>
      )}
      <div className="pb-[80px] pt-4 md:pt-10">
        <ChatScrollAnchor trackVisibility={true} />
      </div>
      <div className="fixed inset-x-0 bottom-0 w-full bg-gradient-to-b duration-300 ease-in-out animate-in dark:from-gray-900/10 dark:from-10% peer-[[data-state=open]]:group-[]:lg:pl-[250px] peer-[[data-state=open]]:group-[]:xl:pl-[300px]] mb-4">
        <div className="mx-auto sm:max-w-2xl sm:px-4">
          <div className="px-4 py-2 space-y-4 border-t shadow-lg dark:bg-slate-800 bg-gray-100 rounded-full sm:border md:py-4">
            <form
              ref={formRef}
              onSubmit={async (e: FormEvent<HTMLFormElement>) => {
                e.preventDefault();
                handleFormSubmit(e);
                setCurrentLlmResponse('');
                if (window.innerWidth < 600) {
                  (e.target as HTMLFormElement)['message']?.blur();
                }
                const value = inputValue.trim();
                setInputValue('');
                if (!value) return;
              }}
            >
            
              <div className="relative flex flex-col w-full overflow-hidden max-h-60 grow dark:bg-slate-800 bg-gray-100 rounded-full sm:border sm:px-2">
                <Textarea
                  ref={inputRef}
                  tabIndex={0}
                  onKeyDown={onKeyDown}
                  placeholder="Send a message."
                  className="min-h-[60px] w-full resize-none bg-transparent px-4 py-[1.3rem] focus-within:outline-none sm:text-sm dark:text-white text-black"
                  autoFocus
                  spellCheck={false}
                  autoComplete="off"
                  autoCorrect="off"
                  name="message"
                  rows={1}
                  value={inputValue}
                  onChange={(e) => setInputValue(e.target.value)}
                />
                <div className="absolute right-0 top-4 sm:right-4">
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Button type="submit" size="icon" disabled={inputValue === ''}>
                        <IconArrowElbow />
                        <span className="sr-only">Send message</span>
                      </Button>
                    </TooltipTrigger>
                    <TooltipContent>Send message</TooltipContent>
                  </Tooltip>
                </div>
              </div>
            </form>
          </div>
        </div>
      </div>
    </div>
  );
};
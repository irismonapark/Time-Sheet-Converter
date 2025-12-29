import { useState, useCallback, useRef, type DragEvent, type ChangeEvent } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Progress } from "@/components/ui/progress";
import { Upload, FileSpreadsheet, Download, RefreshCw, CheckCircle, AlertCircle, Loader2 } from "lucide-react";
import type { SheetInfo } from "@shared/schema";

type WorkflowStep = "upload" | "select" | "processing" | "complete";

export default function Home() {
  const [file, setFile] = useState<File | null>(null);
  const [sheets, setSheets] = useState<SheetInfo[]>([]);
  const [selectedSheet, setSelectedSheet] = useState<string>("");
  const [step, setStep] = useState<WorkflowStep>("upload");
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [progress, setProgress] = useState(0);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleDragOver = useCallback((e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDragging(true);
  }, []);

  const handleDragLeave = useCallback((e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDragging(false);
  }, []);

  const handleDrop = useCallback((e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDragging(false);
    
    const droppedFile = e.dataTransfer.files[0];
    if (droppedFile && (droppedFile.name.endsWith('.xlsx') || droppedFile.name.endsWith('.xls'))) {
      processFile(droppedFile);
    } else {
      setError("엑셀 파일(.xlsx, .xls)만 업로드할 수 있습니다.");
    }
  }, []);

  const handleFileSelect = useCallback((e: ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0];
    if (selectedFile) {
      processFile(selectedFile);
    }
  }, []);

  const processFile = async (uploadedFile: File) => {
    setFile(uploadedFile);
    setError(null);
    setIsLoading(true);
    setProgress(30);

    try {
      const formData = new FormData();
      formData.append("file", uploadedFile);

      const response = await fetch("/api/sheets", {
        method: "POST",
        body: formData,
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || "시트 목록을 불러오는데 실패했습니다.");
      }

      const data = await response.json();
      setSheets(data.sheets);
      setStep("select");
      setProgress(100);
    } catch (err) {
      setError(err instanceof Error ? err.message : "파일 처리 중 오류가 발생했습니다.");
      setFile(null);
    } finally {
      setIsLoading(false);
    }
  };

  const handleConvert = async () => {
    if (!file || !selectedSheet) return;

    setStep("processing");
    setIsLoading(true);
    setError(null);
    setProgress(0);

    const progressInterval = setInterval(() => {
      setProgress((prev) => Math.min(prev + 10, 90));
    }, 200);

    try {
      const formData = new FormData();
      formData.append("file", file);
      formData.append("sheetName", selectedSheet);

      const response = await fetch("/api/convert", {
        method: "POST",
        body: formData,
      });

      clearInterval(progressInterval);
      setProgress(100);

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || "변환에 실패했습니다.");
      }

      const blob = await response.blob();
      const contentDisposition = response.headers.get("Content-Disposition");
      let filename = "상세명세서.xlsx";
      
      if (contentDisposition) {
        const match = contentDisposition.match(/filename\*=UTF-8''(.+)/);
        if (match) {
          filename = decodeURIComponent(match[1]);
        } else {
          const simpleMatch = contentDisposition.match(/filename="?([^"]+)"?/);
          if (simpleMatch) {
            filename = simpleMatch[1];
          }
        }
      }

      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);

      setStep("complete");
      setSuccessMessage(`${filename} 파일이 성공적으로 다운로드되었습니다.`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "변환 중 오류가 발생했습니다.");
      setStep("select");
    } finally {
      setIsLoading(false);
    }
  };

  const handleReset = () => {
    setFile(null);
    setSheets([]);
    setSelectedSheet("");
    setStep("upload");
    setError(null);
    setSuccessMessage(null);
    setProgress(0);
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  };

  const getStepNumber = () => {
    switch (step) {
      case "upload": return 1;
      case "select": return 2;
      case "processing": return 3;
      case "complete": return 4;
      default: return 1;
    }
  };

  return (
    <div className="min-h-screen bg-background py-8 px-4 sm:px-6 lg:px-8">
      <div className="max-w-2xl mx-auto">
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-primary/10 mb-4">
            <FileSpreadsheet className="w-8 h-8 text-primary" />
          </div>
          <h1 className="text-3xl font-bold text-foreground tracking-tight">
            출근일보 변환기
          </h1>
          <p className="mt-2 text-muted-foreground">
            엑셀 출근일보를 상세명세서로 자동 변환합니다
          </p>
        </div>

        <div className="mb-8">
          <div className="flex items-center justify-center gap-2">
            {[1, 2, 3, 4].map((num) => (
              <div key={num} className="flex items-center">
                <div
                  className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium transition-colors ${
                    getStepNumber() >= num
                      ? "bg-primary text-primary-foreground"
                      : "bg-muted text-muted-foreground"
                  }`}
                >
                  {getStepNumber() > num ? (
                    <CheckCircle className="w-5 h-5" />
                  ) : (
                    num
                  )}
                </div>
                {num < 4 && (
                  <div
                    className={`w-12 sm:w-16 h-1 mx-1 rounded-full transition-colors ${
                      getStepNumber() > num ? "bg-primary" : "bg-muted"
                    }`}
                  />
                )}
              </div>
            ))}
          </div>
          <div className="flex justify-center mt-2 text-xs sm:text-sm text-muted-foreground gap-4 sm:gap-8">
            <span className={step === "upload" ? "text-primary font-medium" : ""}>업로드</span>
            <span className={step === "select" ? "text-primary font-medium" : ""}>시트 선택</span>
            <span className={step === "processing" ? "text-primary font-medium" : ""}>변환</span>
            <span className={step === "complete" ? "text-primary font-medium" : ""}>완료</span>
          </div>
        </div>

        <Card className="shadow-lg">
          <CardHeader className="pb-4">
            <CardTitle className="text-xl">
              {step === "upload" && "파일 업로드"}
              {step === "select" && "시트 선택"}
              {step === "processing" && "변환 중..."}
              {step === "complete" && "변환 완료"}
            </CardTitle>
            <CardDescription>
              {step === "upload" && "출근일보 엑셀 파일을 업로드해주세요"}
              {step === "select" && "변환할 시트를 선택해주세요"}
              {step === "processing" && "잠시만 기다려주세요"}
              {step === "complete" && "파일이 성공적으로 변환되었습니다"}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            {error && (
              <Alert variant="destructive">
                <AlertCircle className="h-4 w-4" />
                <AlertDescription>{error}</AlertDescription>
              </Alert>
            )}

            {successMessage && (
              <Alert className="bg-green-50 dark:bg-green-950 border-green-200 dark:border-green-800">
                <CheckCircle className="h-4 w-4 text-green-600 dark:text-green-400" />
                <AlertDescription className="text-green-700 dark:text-green-300">
                  {successMessage}
                </AlertDescription>
              </Alert>
            )}

            {step === "upload" && (
              <div
                data-testid="dropzone-upload"
                onClick={() => fileInputRef.current?.click()}
                onDragOver={handleDragOver}
                onDragLeave={handleDragLeave}
                onDrop={handleDrop}
                className={`
                  relative border-2 border-dashed rounded-lg p-8 sm:p-12 text-center cursor-pointer
                  transition-all duration-200
                  ${isDragging
                    ? "border-primary bg-primary/5"
                    : "border-border hover:border-primary/50 hover:bg-muted/50"
                  }
                  ${isLoading ? "pointer-events-none opacity-50" : ""}
                `}
              >
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".xlsx,.xls"
                  onChange={handleFileSelect}
                  className="hidden"
                  data-testid="input-file"
                />
                <div className="flex flex-col items-center gap-4">
                  {isLoading ? (
                    <Loader2 className="w-12 h-12 text-primary animate-spin" />
                  ) : (
                    <div className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center">
                      <Upload className="w-8 h-8 text-primary" />
                    </div>
                  )}
                  <div>
                    <p className="text-lg font-medium text-foreground">
                      {isLoading ? "파일 처리 중..." : "파일 선택 또는 드래그앤드롭"}
                    </p>
                    <p className="mt-1 text-sm text-muted-foreground">
                      .xlsx 또는 .xls 파일
                    </p>
                  </div>
                </div>
              </div>
            )}

            {(step === "select" || step === "processing" || step === "complete") && file && (
              <div className="flex items-center gap-3 p-4 bg-muted/50 rounded-lg">
                <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
                  <FileSpreadsheet className="w-5 h-5 text-primary" />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="font-medium text-foreground truncate">{file.name}</p>
                  <p className="text-sm text-muted-foreground">
                    {(file.size / 1024).toFixed(1)} KB
                  </p>
                </div>
              </div>
            )}

            {step === "select" && (
              <div className="space-y-4">
                <div className="space-y-2">
                  <label className="text-sm font-medium text-foreground">
                    시트 선택
                  </label>
                  <Select
                    value={selectedSheet}
                    onValueChange={setSelectedSheet}
                    data-testid="select-sheet"
                  >
                    <SelectTrigger className="w-full" data-testid="select-sheet-trigger">
                      <SelectValue placeholder="변환할 시트를 선택하세요" />
                    </SelectTrigger>
                    <SelectContent>
                      {sheets.map((sheet) => (
                        <SelectItem 
                          key={sheet.index} 
                          value={sheet.name}
                          data-testid={`select-sheet-option-${sheet.index}`}
                        >
                          {sheet.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
            )}

            {step === "processing" && (
              <div className="py-8">
                <div className="flex flex-col items-center gap-4">
                  <Loader2 className="w-12 h-12 text-primary animate-spin" />
                  <p className="text-muted-foreground">상세명세서로 변환 중입니다...</p>
                  <Progress value={progress} className="w-full max-w-xs" />
                </div>
              </div>
            )}

            {step === "complete" && (
              <div className="py-8">
                <div className="flex flex-col items-center gap-4">
                  <div className="w-16 h-16 rounded-full bg-green-100 dark:bg-green-900 flex items-center justify-center">
                    <CheckCircle className="w-8 h-8 text-green-600 dark:text-green-400" />
                  </div>
                  <p className="text-lg font-medium text-foreground">변환이 완료되었습니다</p>
                  <p className="text-muted-foreground text-center">
                    다운로드가 자동으로 시작됩니다.<br />
                    시작되지 않으면 다시 변환해주세요.
                  </p>
                </div>
              </div>
            )}

            <div className="flex flex-col sm:flex-row gap-3 pt-2">
              {step === "select" && (
                <>
                  <Button
                    onClick={handleConvert}
                    disabled={!selectedSheet || isLoading}
                    className="flex-1"
                    size="lg"
                    data-testid="button-convert"
                  >
                    {isLoading ? (
                      <Loader2 className="w-5 h-5 mr-2 animate-spin" />
                    ) : (
                      <Download className="w-5 h-5 mr-2" />
                    )}
                    상세명세서로 변환
                  </Button>
                  <Button
                    onClick={handleReset}
                    variant="outline"
                    size="lg"
                    data-testid="button-reset"
                  >
                    <RefreshCw className="w-5 h-5 mr-2" />
                    다시하기
                  </Button>
                </>
              )}

              {step === "complete" && (
                <Button
                  onClick={handleReset}
                  className="w-full"
                  size="lg"
                  data-testid="button-new-conversion"
                >
                  <RefreshCw className="w-5 h-5 mr-2" />
                  새로운 파일 변환하기
                </Button>
              )}
            </div>
          </CardContent>
        </Card>

        <div className="mt-8 text-center text-sm text-muted-foreground">
          <p>지원 파일 형식: .xlsx, .xls</p>
          <p className="mt-1">남/여 근무자별 자동 단가 계산</p>
        </div>
      </div>
    </div>
  );
}

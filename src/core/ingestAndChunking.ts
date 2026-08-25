import { PDFLoader } from "@langchain/community/document_loaders/fs/pdf";
import { RecursiveCharacterTextSplitter } from "@langchain/textsplitters";

export async function ingestAndChunk(pdfFilePath: string) {
    // ===================================================================
    // INGESTION:
    // Load raw document and split into chunks
    // ===================================================================
    const loader = new PDFLoader(pdfFilePath, { splitPages: true });
    const docs = await loader.load();

    const splitter = new RecursiveCharacterTextSplitter({
        chunkSize: 1000,
        chunkOverlap: 200,
        separators: ["\n\n", "\n", " ", ""]
    });

    const splitDocs = await splitter.splitDocuments(docs);

    const chunks = splitDocs.map((doc, index) => ({
        id: `chunk${index + 1}`,
        text: doc.pageContent.trim(),
        pageNumber: (doc.metadata.loc?.pageNumber as number) || 1
    }));

    return chunks;
}
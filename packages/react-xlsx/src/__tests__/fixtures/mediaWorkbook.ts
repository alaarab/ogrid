import ExcelJS from 'exceljs';
import JSZip from 'jszip';

// A real PNG and hand-authored, portable OOXML chart/pivot parts. ExcelJS
// authors the cells/images; it has no chart or pivot authoring API.
export const PNG = 'iVBORw0KGgoAAAANSUhEUgAAABAAAAAQCAYAAAAf8/9hAAAAGUlEQVR4nGNQLHb7TwlmGDVg1IBRA4aLAQDNwdkQM/32UQAAAABJRU5ErkJggg==';
const R = 'http://schemas.openxmlformats.org/officeDocument/2006/relationships';
const S = 'http://schemas.openxmlformats.org/spreadsheetml/2006/main';
const D = 'http://schemas.openxmlformats.org/drawingml/2006/spreadsheetDrawing';
const A = 'http://schemas.openxmlformats.org/drawingml/2006/main';
const C = 'http://schemas.openxmlformats.org/drawingml/2006/chart';
const rels = (content: string) => `<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">${content}</Relationships>`;
const rel = (id: string, type: string, target: string) => `<Relationship Id="${id}" Type="${R}/${type}" Target="${target}"/>`;
const anchor = (chartId: string, col = 2) => `<xdr:twoCellAnchor><xdr:from><xdr:col>${col}</xdr:col><xdr:colOff>0</xdr:colOff><xdr:row>1</xdr:row><xdr:rowOff>0</xdr:rowOff></xdr:from><xdr:to><xdr:col>${col + 3}</xdr:col><xdr:colOff>0</xdr:colOff><xdr:row>5</xdr:row><xdr:rowOff>0</xdr:rowOff></xdr:to><xdr:graphicFrame macro=""><xdr:nvGraphicFramePr><xdr:cNvPr id="1" name="Sales chart"/><xdr:cNvGraphicFramePr/></xdr:nvGraphicFramePr><xdr:xfrm><a:off x="0" y="0"/><a:ext cx="0" cy="0"/></xdr:xfrm><a:graphic><a:graphicData uri="${C}"><c:chart xmlns:c="${C}" xmlns:r="${R}" r:id="${chartId}"/></a:graphicData></a:graphic></xdr:graphicFrame><xdr:clientData/></xdr:twoCellAnchor>`;

export async function mediaWorkbookBlob(options: { nativeOffsets?: boolean; oneCellAnchors?: boolean; pivotStyles?: boolean; externalConnection?: boolean } = {}): Promise<Blob> {
  const wb = new ExcelJS.Workbook();
  const ws = wb.addWorksheet('Sales');
  ws.addRows([['Region', 'Sales', 'Label', 'Pivot', 'Total', 'Spacer'], ['East', 10], ['West', 20], ['East', 30]]);
  // Preserve ordinary workbook relationships and pivot result cells too.
  ws.getCell('A6').value = { text: 'Source', hyperlink: 'https://example.com/sales' };
  ws.getCell('A6').note = 'Keep this note';
  ws.getCell('D8').value = 'Region'; ws.getCell('E8').value = 'Sum of Sales';
  ws.getCell('D9').value = 'East'; ws.getCell('E9').value = 40;
  ws.getCell('D10').value = 'West'; ws.getCell('E10').value = 20;
  ws.getCell('D11').value = 'Grand Total'; ws.getCell('E11').value = 60;
  ws.getColumn(1).width = 18;
  ws.getRow(2).height = 30;
  ws.addImage(wb.addImage({ base64: PNG, extension: 'png' }), { tl: { col: 0.25, row: 1.25 }, br: { col: 1.75, row: 3.5 } });
  const other = wb.addWorksheet('Charts');
  other.addRows([['Region', 'Sales', 'Label', 'D', 'E', 'F'], ['East', 10], ['West', 20], ['East', 30], [null], ['End', 60]]);
  const zip = await JSZip.loadAsync(await wb.xlsx.writeBuffer());
  const drawing = await zip.file('xl/drawings/drawing1.xml')!.async('string');
  // A nonsequential source drawing number must not overwrite ExcelJS drawing1.
  zip.file('xl/drawings/drawing7.xml', drawing.replace('</xdr:wsDr>', anchor('rId1chart') + '</xdr:wsDr>'));
  zip.file('xl/drawings/_rels/drawing7.xml.rels', (await zip.file('xl/drawings/_rels/drawing1.xml.rels')!.async('string')).replace('</Relationships>', rel('rId1chart', 'chart', '../charts/chart1.xml') + '</Relationships>'));
  zip.remove('xl/drawings/drawing1.xml'); zip.remove('xl/drawings/_rels/drawing1.xml.rels');
  const sheetRels = 'xl/worksheets/_rels/sheet1.xml.rels';
  zip.file(sheetRels, (await zip.file(sheetRels)!.async('string')).replace('drawing1.xml', 'drawing7.xml').replace('</Relationships>', rel('rId1pivot', 'pivotTable', '../pivotTables/pivotTable1.xml') + '</Relationships>'));
  zip.file('xl/drawings/drawing8.xml', `<xdr:wsDr xmlns:xdr="${D}" xmlns:a="${A}">${anchor('rId1', 0)}</xdr:wsDr>`);
  zip.file('xl/drawings/_rels/drawing8.xml.rels', rels(rel('rId1', 'chart', '../charts/chart1.xml')));
  zip.file('xl/worksheets/sheet2.xml', (await zip.file('xl/worksheets/sheet2.xml')!.async('string')).replace('</worksheet>', '<drawing r:id="rId1"/></worksheet>'));
  zip.file('xl/worksheets/_rels/sheet2.xml.rels', rels(rel('rId1', 'drawing', '../drawings/drawing8.xml')));
  zip.file('xl/charts/chart1.xml', `<c:chartSpace xmlns:c="${C}" xmlns:a="${A}" xmlns:r="${R}"><c:chart><c:title><c:tx><c:rich><a:bodyPr/><a:lstStyle/><a:p><a:r><a:rPr lang="en-US"/><a:t>Sales by Region</a:t></a:r></a:p></c:rich></c:tx><c:overlay val="0"/></c:title><c:plotArea><c:layout/><c:barChart><c:barDir val="col"/><c:grouping val="clustered"/><c:ser><c:idx val="0"/><c:order val="0"/><c:tx><c:v>Sales</c:v></c:tx><c:cat><c:strRef><c:f>Sales!$A$2:$A$4</c:f><c:strCache><c:ptCount val="3"/><c:pt idx="0"><c:v>East</c:v></c:pt><c:pt idx="1"><c:v>West</c:v></c:pt><c:pt idx="2"><c:v>East</c:v></c:pt></c:strCache></c:strRef></c:cat><c:val><c:numRef><c:f>Sales!$B$2:$B$4</c:f><c:numCache><c:formatCode>General</c:formatCode><c:ptCount val="3"/><c:pt idx="0"><c:v>10</c:v></c:pt><c:pt idx="1"><c:v>20</c:v></c:pt><c:pt idx="2"><c:v>30</c:v></c:pt></c:numCache></c:numRef></c:val></c:ser><c:axId val="10"/><c:axId val="20"/></c:barChart><c:catAx><c:axId val="10"/><c:scaling><c:orientation val="minMax"/></c:scaling><c:axPos val="b"/><c:crossAx val="20"/><c:crosses val="autoZero"/><c:auto val="1"/><c:lblAlgn val="ctr"/><c:lblOffset val="100"/></c:catAx><c:valAx><c:axId val="20"/><c:scaling><c:orientation val="minMax"/></c:scaling><c:axPos val="l"/><c:majorGridlines/><c:numFmt formatCode="General" sourceLinked="1"/><c:crossAx val="10"/><c:crosses val="autoZero"/><c:crossBetween val="between"/></c:valAx></c:plotArea><c:plotVisOnly val="1"/></c:chart></c:chartSpace>`);
  // A chart dependency collides with an ExcelJS-emitted media filename.
  zip.file('xl/charts/_rels/chart1.xml.rels', rels(rel('rIdBackground', 'image', '../media/image1.png')));
  zip.file('xl/charts/chart1.xml', (await zip.file('xl/charts/chart1.xml')!.async('string')).replace('</c:chartSpace>', '<c:spPr><a:blipFill><a:blip r:embed="rIdBackground"/><a:stretch><a:fillRect/></a:stretch></a:blipFill></c:spPr></c:chartSpace>'));
  zip.file('xl/pivotTables/pivotTable1.xml', `<pivotTableDefinition xmlns="${S}" name="SalesPivot" cacheId="3" dataCaption="Values" updatedVersion="6" minRefreshableVersion="3" createdVersion="6" useAutoFormatting="1" rowGrandTotals="1" colGrandTotals="1"><location ref="D8:E11" firstHeaderRow="1" firstDataRow="1" firstDataCol="1"/><pivotFields count="2"><pivotField axis="axisRow" showAll="0"><items count="3"><item x="0"/><item x="1"/><item t="default"/></items></pivotField><pivotField dataField="1" showAll="0"/></pivotFields><rowFields count="1"><field x="0"/></rowFields><rowItems count="3"><i><x v="0"/></i><i><x v="1"/></i><i t="grand"><x/></i></rowItems><dataFields count="1"><dataField name="Sum of Sales" fld="1" subtotal="sum" baseField="0" baseItem="0"/></dataFields><pivotTableStyleInfo name="PivotStyleLight16" showRowHeaders="1" showColHeaders="1" showRowStripes="0" showColStripes="0" showLastColumn="1"/></pivotTableDefinition>`);
  zip.file('xl/pivotTables/_rels/pivotTable1.xml.rels', rels(rel('rId1', 'pivotCacheDefinition', '../pivotCache/pivotCacheDefinition1.xml')));
  zip.file('xl/pivotCache/pivotCacheDefinition1.xml', `<pivotCacheDefinition xmlns="${S}" xmlns:r="${R}" r:id="rId1" refreshOnLoad="0" recordCount="3" createdVersion="6" refreshedVersion="6" minRefreshableVersion="3"><cacheSource type="worksheet"><worksheetSource ref="A1:B4" sheet="Sales"/></cacheSource><cacheFields count="2"><cacheField name="Region" numFmtId="0"><sharedItems count="2"><s v="East"/><s v="West"/></sharedItems></cacheField><cacheField name="Sales" numFmtId="0"><sharedItems containsString="0" containsNumber="1" containsInteger="1" minValue="10" maxValue="30" count="3"><n v="10"/><n v="20"/><n v="30"/></sharedItems></cacheField></cacheFields></pivotCacheDefinition>`);
  zip.file('xl/pivotCache/_rels/pivotCacheDefinition1.xml.rels', rels(rel('rId1', 'pivotCacheRecords', 'pivotCacheRecords1.xml')));
  zip.file('xl/pivotCache/pivotCacheRecords1.xml', `<pivotCacheRecords xmlns="${S}" count="3"><r><x v="0"/><x v="0"/></r><r><x v="1"/><x v="1"/></r><r><x v="0"/><x v="2"/></r></pivotCacheRecords>`);
  zip.file('xl/workbook.xml', (await zip.file('xl/workbook.xml')!.async('string')).replace('</workbook>', '<pivotCaches><pivotCache cacheId="3" r:id="rId1cache"/></pivotCaches></workbook>'));
  zip.file('xl/_rels/workbook.xml.rels', (await zip.file('xl/_rels/workbook.xml.rels')!.async('string')).replace('</Relationships>', rel('rId1cache', 'pivotCacheDefinition', 'pivotCache/pivotCacheDefinition1.xml') + '</Relationships>'));
  const overrides = [
    ['drawings/drawing8.xml', 'drawing'], ['charts/chart1.xml', 'chart'],
    ['pivotTables/pivotTable1.xml', 'pivotTable'], ['pivotCache/pivotCacheDefinition1.xml', 'pivotCacheDefinition'], ['pivotCache/pivotCacheRecords1.xml', 'pivotCacheRecords'],
  ].map(([path, type]) => `<Override PartName="/xl/${path}" ContentType="application/vnd.openxmlformats-officedocument.${type === 'drawing' || type === 'chart' ? 'drawingml' : 'spreadsheetml'}.${type}+xml"/>`).join('');
  zip.file('[Content_Types].xml', (await zip.file('[Content_Types].xml')!.async('string')).replace('drawing1.xml', 'drawing7.xml').replace('</Types>', overrides + '</Types>'));
  if (options.nativeOffsets) {
    // Native markers deliberately bypass ExcelJS's character/point conversion.
    const from = (px: number) => `<xdr:from><xdr:col>0</xdr:col><xdr:colOff>${Math.round(px * 9525)}</xdr:colOff><xdr:row>1</xdr:row><xdr:rowOff>95250</xdr:rowOff></xdr:from>`;
    const to = '<xdr:to><xdr:col>1</xdr:col><xdr:colOff>190500</xdr:colOff><xdr:row>3</xdr:row><xdr:rowOff>47625</xdr:rowOff></xdr:to>';
    let drawing = await zip.file('xl/drawings/drawing7.xml')!.async('string');
    drawing = drawing.replace(/<xdr:from>.*?<\/xdr:from>/g, (_, index: number) => from(index === drawing.indexOf('<xdr:from>') ? 45000 / 9525 : 40)).replace(/<xdr:to>.*?<\/xdr:to>/g, to);
    if (options.oneCellAnchors) drawing = drawing.replace(/<xdr:twoCellAnchor[^>]*>/g, '<xdr:oneCellAnchor>').replace(/<xdr:to>.*?<\/xdr:to>/g, '<xdr:ext cx="762000" cy="285750"/>').replace(/<\/xdr:twoCellAnchor>/g, '</xdr:oneCellAnchor>');
    zip.file('xl/drawings/drawing7.xml', drawing);
  }
  if (options.pivotStyles) {
    const styles = await zip.file('xl/styles.xml')!.async('string');
    zip.file('xl/styles.xml', styles.replace('<fonts', () => '<numFmts count="2"><numFmt numFmtId="170" formatCode="&quot;$&quot;#,##0.0000"/><numFmt numFmtId="171" formatCode="yyyy-mm-dd&quot; UTC&quot;"/></numFmts><fonts')
      .replace(/<dxfs[^>]*\/>/, () => '<dxfs count="2"><dxf><font><b/></font></dxf><dxf><font><color rgb="FF009900"/></font><numFmt numFmtId="170" formatCode="&quot;$&quot;#,##0.0000"/></dxf></dxfs>'));
    const pivotPath = 'xl/pivotTables/pivotTable1.xml';
    zip.file(pivotPath, (await zip.file(pivotPath)!.async('string')).replace('<dataField name=', '<dataField numFmtId="170" name=').replace('<pivotField dataField=', '<pivotField numFmtId="171" dataField=').replace('<pivotTableStyleInfo', '<formats count="1"><format dxfId="1"><pivotArea type="data"/></format></formats><pivotTableStyleInfo'));
    const cachePath = 'xl/pivotCache/pivotCacheDefinition1.xml';
    zip.file(cachePath, (await zip.file(cachePath)!.async('string')).replace('name="Sales" numFmtId="0"', 'name="Sales" numFmtId="170"'));
  }
  if (options.externalConnection) {
    const cachePath = 'xl/pivotCache/pivotCacheDefinition1.xml';
    zip.file(cachePath, (await zip.file(cachePath)!.async('string')).replace(/<cacheSource.*?<\/cacheSource>/, '<cacheSource type="external" connectionId="1"/>'));
    zip.file('xl/connections.xml', `<connections xmlns="${S}" xmlns:r="${R}"><connection id="1" name="Sales DB" type="5" refreshedVersion="6" background="1" saveData="1"><dbPr connection="Provider=SalesProvider;Data Source=sales.example" command="SELECT Region, Sales FROM Sales"/><extLst><ext uri="ogrid-test"><source xmlns="urn:connection-source" r:id="rIdSource"/></ext></extLst></connection></connections>`);
    zip.file('xl/_rels/connections.xml.rels', rels(rel('rIdSource', 'customXml', '../customXml/item1.xml') + '<Relationship Id="rIdExternal" Type="' + R + '/externalLink" Target="https://example.com/sales.odc" TargetMode="External"/>'));
    zip.file('customXml/item1.xml', '<source xmlns="urn:connection-source">Sales connection metadata</source>');
    zip.file('xl/_rels/workbook.xml.rels', (await zip.file('xl/_rels/workbook.xml.rels')!.async('string')).replace('</Relationships>', rel('rIdConnections', 'connections', 'connections.xml') + '</Relationships>'));
    zip.file('[Content_Types].xml', (await zip.file('[Content_Types].xml')!.async('string')).replace('</Types>', '<Override PartName="/xl/connections.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.connections+xml"/></Types>'));
  }
  return new Blob([new Uint8Array(await zip.generateAsync({ type: 'uint8array', compression: 'DEFLATE' }))]);
}

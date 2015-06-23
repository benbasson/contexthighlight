/* ***** BEGIN LICENSE BLOCK *****
 * Version: MPL 1.1/GPL 2.0/LGPL 2.1
 *
 * The contents of this file are subject to the Mozilla Public License Version
 * 1.1 (the "License"); you may not use this file except in compliance with
 * the License. You may obtain a copy of the License at
 * http://www.mozilla.org/MPL/
 *
 * Software distributed under the License is distributed on an "AS IS" basis,
 * WITHOUT WARRANTY OF ANY KIND, either express or implied. See the License
 * for the specific language governing rights and limitations under the
 * License.
 *
 * The Original Code is Context Highlight.
 *
 * The Initial Developer of the Original Code is
 *   Ben Basson <ben@basson.at>
 * Portions created by the Initial Developer are Copyright (C) 2005
 * the Initial Developer. All Rights Reserved.
 *
 * Contributor(s):
 *   Ben Basson <ben@basson.at>
 *   Rue <quill@ethereal.net>
 *
 * Alternatively, the contents of this file may be used under the terms of
 * either the GNU General Public License Version 2 or later (the "GPL"), or
 * the GNU Lesser General Public License Version 2.1 or later (the "LGPL"),
 * in which case the provisions of the GPL or the LGPL are applicable instead
 * of those above. If you wish to allow use of your version of this file only
 * under the terms of either the GPL or the LGPL, and not to allow others to
 * use your version of this file under the terms of the MPL, indicate your
 * decision by deleting the provisions above and replace them with the notice
 * and other provisions required by the GPL or the LGPL. If you do not delete
 * the provisions above, a recipient may use your version of this file under
 * the terms of any one of the MPL, the GPL or the LGPL.
 *
 * ***** END LICENSE BLOCK ***** */

var contextHL = {

  init: function () {
    var context = document.getElementById("contentAreaContextMenu");
    context.addEventListener("popupshowing",contextHL.popup,false);
    
    contextHL.word = document.getElementById("context-contexthighlightword");
    contextHL.words = document.getElementById("context-contexthighlightwords");
    contextHL.phrase = document.getElementById("context-contexthighlightphrase");
    contextHL.clear = document.getElementById("context-contextclearhighlight");
    
    contextHL.highlightColours = new Array("255,255,0","160,255,255","255,0,0","255,153,153","255,102,255","153,255,153","0,70,153","136,0,0","136,104,0");
    contextHL.textColours = new Array("255,0,0","0,0,0","255,255,255","0,0,0","0,0,0","0,0,0","255,255,255","255,255,255","255,255,255");
    contextHL.createColourArray();
    contextHL.consoleLog = false;
    contextHL.lastColour = 0;
  },
  
  popup: function ()
  {
    if (!gContextMenu.isTextSelected)
      contextHL.hideitems();
    else
    {      
      var spaceChar = getBrowserSelection().indexOf(" ");
  		if (spaceChar == -1)
  		{
        contextHL.hideitems();
        contextHL.word.hidden = false;
  		}
  		else
  		{
        contextHL.showitems();
        contextHL.word.hidden = true; 		
  		}
    }
    if (gContextMenu.target.ownerDocument)
    {
      contextHL.currentDocument = gContextMenu.target.ownerDocument;      
      if (contextHL.currentDocument.countHighlighted > 0)
        contextHL.clear.hidden = false;
      else
        contextHL.clear.hidden = true;
    }
  },
  
  hideitems: function ()
  {
    contextHL.word.hidden = true;
    contextHL.words.hidden = true;
    contextHL.phrase.hidden = true;
    contextHL.clear.hidden = true;
  },
  
  showitems: function () {
    contextHL.word.hidden = false;
    contextHL.words.hidden = false;
    contextHL.phrase.hidden = false;
    contextHL.clear.hidden = false;
  },
  
  /*
    Binary Search Function
    Original code written by Rue (http://homepage.mac.com/rue/binary-search-comparison.html)
  */
  
  binaryRangeSearch: function (high, startIndex, endIndex, searchRe, rangeMatches, externalCounter)
  {
    if (externalCounter.count++ > externalCounter.countMax || externalCounter.matches.length > externalCounter.matchMax) 
      return;
      
    var origNode;
    var node = origNode = high.startContainer;
    var origStartIndex = startIndex;
    var origEndIndex = endIndex;
  
    if (endIndex - startIndex == 1 && node.childNodes.length > 0)
    {
      node = node.childNodes[endIndex-1];
      while (node.childNodes.length == 1)
      {
        if (node.nodeName.toLowerCase() in {script:null,style:null,textarea:null,input:null})
          return; // ignore these elements
        node = node.firstChild;
      }
  
      startIndex = 0;
      endIndex = node.childNodes.length;
  
      if (endIndex == 0)
      {
        rangeMatches.push([node]);
        return;
      } // this *must* come before we change high's indices (next)
  
      high.setStart(node, startIndex);
      high.setEnd(node, endIndex);
    }
  
    var midIndex = startIndex + Math.ceil((endIndex - startIndex) / 2);
    if (midIndex == endIndex || endIndex == 0)
    { 
      rangeMatches.push([node]);
      return;
    }
  
    high.setEnd(node, midIndex);
    var highString = high.toString();
  
    if (highString.match(searchRe))
    {
      var deeper = true;
      contextHL.binaryRangeSearch(high, startIndex, midIndex, searchRe, rangeMatches, externalCounter);
    }
  
    // split range
    var low = high;
    low.setEnd(node, endIndex); // *must* come first: since we altered the end (above), we have to set it back.
    low.setStart(node, midIndex);
  
    if (!deeper)
    { 
      var highLength = highString.length; 
      var lowString = low.toString(); 
      highString += lowString;
      var lowMatch = lowString.match(searchRe);
      var overlaps = lowMatch && highString.indexOf(lowMatch[0]) < highLength;
    }
  
    else
      lowMatch = low.toString().match(searchRe);
    
    /* 
      this will log subsearches on 'low'. if you do this, you'll need to 
      restrict multi-element handling to just the First Contiguous Match 
      -- otherwise you'll duplicate handling
    */
    
    var subSearchLowerOverlap = false;
    if (lowMatch && (!overlaps || subSearchLowerOverlap))
    { 
      deeper = true;
      contextHL.binaryRangeSearch(low, midIndex, endIndex, searchRe, rangeMatches, externalCounter);
    }

    if (!deeper || overlaps)
      rangeMatches.push([origNode,origStartIndex,origEndIndex]);
      
    return;
  },

  doSearch: function (aWindow,aTest,aBackgroundColour,aTextColour)
  {
    var high = aWindow.document.createRange();
    high.selectNodeContents(aWindow.document.body);
    
    var startIndex = 0, endIndex = high.commonAncestorContainer.childNodes.length;
    var rangeMatches = [];
    
    /* search-limits */
    var externalCounter = {countMax:6000, matchMax:6000, count:0, matches:rangeMatches};
    if (high.toString().match(aTest)) 
    contextHL.binaryRangeSearch(high, startIndex, endIndex, aTest, rangeMatches, externalCounter);

    /* highlight the matches */
    for (var n in rangeMatches) {
      if (rangeMatches[n].length == 1) {
        contextHL.highlightNode(rangeMatches[n][0],aBackgroundColour,aTextColour);
      }
    }
  },
    
  highlight: function (aEvent, aMethod)
  {
    var aText = getBrowserSelection();
    
    /*
      Text is prepared by stripping common punctuation that isn't followed by an
      alphanumeric letter, i.e. commas and periods at the end of words are removed.
      Quotes, colons, parenthesis, brackets and braces are also trimmed.
      but periods separating numbers (255.255.255.0) and URLs (www.mozilla.org)
      are left untouched, since they are potentially quite useful.
    */      
    
    aText = aText.replace(/([\?;\:!,\.\)\]\}\"\'\`]+)(?=\B)/,"");
    aText = aText.replace(/(?=\B)([\(\[\{\"\'\`\:]+)/,"");
    
    /*
      Characters remaining are then escaped so that the regexp does not use
      wildcards or return unexpected matches.
    */
    
    aText = aText.replace(/\\/,"\\");
    aText = aText.replace(/\,/,"\,");
    aText = aText.replace(/\?/,"\?");
    aText = aText.replace(/\./,"\.");
    aText = aText.replace(/\^/,"\^");
    aText = aText.replace(/\$/,"\$");
    aText = aText.replace(/\*/,"\*");
    aText = aText.replace(/\+/,"\+");

    var searchArray, unsortedArray = new Array();
    var currentDoc = contextHL.currentDocument;
    var currentWin = currentDoc.defaultView.window;
  
    if (currentDoc.countHighlighted)
    {
      if (currentDoc.countHighlighted > 0 && !aEvent.ctrlKey)
        contextHL.clearHL();
    }
    
    /* prevent simple mistake that would take a long time to compute */
    if (aText != " ")
    {
      /* split words into array to traverse */
      if (aMethod == "phrase") searchArray = [aText];
      else 
      {
        var temp = aText.split(" ");
        /* remove duplicates and copy array before sorting */
        searchArray = contextHL.removeDuplicates(temp);
        for (var i = 0; i < searchArray.length; i++)
          unsortedArray.push(searchArray[i]);
        searchArray = contextHL.sortArray(searchArray);
      }
    }
    else
      return;
  
    var highlightColours = contextHL.highlightColours;
    var col = 0, len, i;
    
    for (i = 0, len = searchArray.length; i < len; i++) 
    {
      /*
        Get correct colours for highlighting - for consistency
      */
      if (len > 1)
      {
        for (var j = 0; j < len; j++)
          if (searchArray[i] == unsortedArray[j])
            col = j;
      }
       
      col = col + contextHL.lastColour;
      
      if (col >= highlightColours.length)
        col = col % highlightColours.length;
      /*
        Send each individual word to the binary search function with a semi-unique colour.
        Excess whitespace is trimmed. Test for blank strings to prevent crashing.
      */
      if (searchArray[i] != "")
      {
        var regexp = new RegExp(contextHL.currentWord = searchArray[i].replace(/\s*/,""),"i");
        contextHL.doSearch(currentWin,regexp,highlightColours[col],contextHL.textColours[col]);
      }
      
      // increment colour in case of repeated highlights
      col = col + 1;
      
      if (col > contextHL.lastColour) {
        contextHL.lastColour = col;
      }
      gBrowser.contentWindow.getSelection().collapseToStart();
    }
  },

  highlightNode: function (aNode,aBackgroundColour,aTextColour) 
  {
    var match = contextHL.currentWord.toLowerCase();
    var text = aNode.data.toLowerCase();
    if (!contextHL.currentDocument.countHighlighted)
      contextHL.currentDocument.countHighlighted = 0;
    while (text.indexOf(match) != -1)
    {
      var textColour;
      var matchText = aNode.splitText(text.toUpperCase().indexOf(match.toUpperCase()));
      var bgColour = contextHL.checkHightlightColour(matchText,aBackgroundColour);
      var changed = bgColour[1];
      bgColour = bgColour[0];
  
      if (changed)
        textColour = contextHL.checkTextContrast(contextHL.getRGBColour(aTextColour),bgColour);
      else
        textColour = contextHL.getRGBColour(aTextColour);
      
      aNode = matchText.splitText(match.length);
      var clone = matchText.cloneNode(true);
      
      var span = contextHL.currentDocument.createElement("span");
      var concat_id = "contextHighlighted" + contextHL.currentDocument.countHighlighted++;
      span.setAttribute("id", concat_id);
      span.setAttribute("class","contextHighlighted");
      
      span.style.backgroundColor = "rgb(" + bgColour + ")";
      span.style.color = "rgb(" + textColour + ")";
      span.style.display = "inline";
      span.style.cssFloat = "inherit";
      span.style.fontWeight = "inherit";
      span.style.margin = "inherit";
      
      span.appendChild(clone);
      matchText.parentNode.replaceChild(span,matchText);
      
      // Move to next node
      aNode = span.nextSibling;
      text = aNode.data.toLowerCase();
    }
  },

  clearHL: function ()
  {
    var currentDocument = contextHL.currentDocument;
    
    if (!currentDocument)
      return;
      
    // Find and remove all highlight span nodes
    while (contextHL.currentDocument.countHighlighted > 0)
    {
      var concat_id = "contextHighlighted" + --contextHL.currentDocument.countHighlighted;
      var oldSpan = currentDocument.getElementById(concat_id);
      var parent = oldSpan.parentNode;
      parent.replaceChild(oldSpan.childNodes[0], oldSpan);
      parent.normalize();
    }
    contextHL.lastColour = 0;
  },
  
  checkHightlightColour: function (aNode,aBackgroundColour)
  {
    var nodeBgColour = null;
    var currentDocument = contextHL.currentDocument;
    var currentWindow = currentDocument.defaultView;
    
    while (aNode != currentDocument.body && typeof currentDocument.body != "undefined")
    {
      if (!aNode.style)
        aNode = aNode.parentNode;
      else
      {
        nodeBgColour = currentWindow.getComputedStyle(aNode,null).getPropertyValue("background-color");
        if (nodeBgColour != null && nodeBgColour != "transparent" && nodeBgColour != "inherit")
        {
          var checkOK = true;
          break;
        }
        else
          aNode = aNode.parentNode;
      }
    }
    
    if (checkOK == false)
      nodeBgColour = "255,255,255";
      
    var getRGB = contextHL.getRGBColour;
    nodeBgColour = getRGB(nodeBgColour);
    aBackgroundColour = getRGB(aBackgroundColour)

    return contextHL.checkContrast(aBackgroundColour,nodeBgColour);
  },
  
  /*
    Ensures colours contrast sufficiently
    returns an inverted colour if they do not
  */
  
  checkContrast: function (aColour1, aColour2)
  {
    var testValues = aColour1.split(","); 
    var RGBValues = aColour2.split(",");
    var diff = 0;
    var colChanged = false;
    
    for (var j = 0; j <= 2; j++)
      diff += Math.abs(parseInt(testValues[j]) - parseInt(RGBValues[j]));
      
    if (diff <= 50)
    {
      aColour1 = contextHL.getInvertColour(aColour1);
      colChanged = true;
    }
    
    return [aColour1, colChanged];
  },

  /*
    Ensures that text contrasts sufficiently...
    If it contrasts by more than 255, return an inverted
    background colour, to make text easier to read
  */

  checkTextContrast: function (aTextColour, aBackgroundColour)
  {
    var testValues = aTextColour.split(","); 
    var RGBValues = aBackgroundColour.split(",");
    var diff = 0;
    
    for (var j = 0; j <= 2; j++)
      diff += Math.abs(parseInt(testValues[j]) - parseInt(RGBValues[j]));
      
    if (diff <= 50)
      aTextColour = contextHL.getInvertColour(aTextColour);
    
    else if (diff >= 255)
      aTextColour = contextHL.getInvertColour(aBackgroundColour);
    
    return aTextColour;
  },

  /*
    This function sorts the words in order of length, long to short,
    for two reasons: 
    
    1) Longer words being matched first makes highlighting
    appear sooner (quicker to match longer words)
    
    2) So that the extension correctly handles words-within-words... 
    i.e. "within" and "it".
      
      Match "it" gives w<span>it</span>hin.
       -> Match "within" fails.
       
      Match "within" gives <span>within</span>.
       -> Match "it" gives <span>w<span>it</span>hin</span>.
    
    Clearly the latter is more desirable. Although matching
    should be done between adjacent elements, this will have
    to come with a future release.
  */
  
  sortArray: function (aArray)
  {
    return aArray.sort(function(a,b){return b.length - a.length});
  },
  
  /*
    Remove duplicates from an array.
    Used to prevent duplicate highlighting,
    which causes inverted colours to be used
    without necessity.
  */
  
  removeDuplicates: function (aArray)
  {
    var uniqueArray = new Array();
    for (var i = 0; i < aArray.length; i++)
    {
      if (uniqueArray.indexOf(aArray[i]) == -1)
        uniqueArray.push(aArray[i]);
    }
    return uniqueArray;
  },
  
  /*
    Returns RGB value
  */
  
  getRGBColour: function (aColour)
  {
    if (!aColour)
      return "255,255,255";
      
    var colourArray = contextHL.colourArray;

    if (aColour.indexOf("rgb(") != -1)
      return aColour.substring(4, aColour.length - 1);
    else
    {
      if (colourArray[aColour])
        return colourArray[aColour];
      else if (aColour.indexOf(",") == -1)
      {
        if (contextHL.consoleLog)
        {
        var output = "Colour '" + aColour + "' not matched to RGB.\n'255,255,255' assumed.";
          Components.classes["@mozilla.org/consoleservice;1"]
          .getService(Components.interfaces.nsIConsoleService)
          .logStringMessage("Context Highlight:\n" + output);
        }
        return "255,255,255";
      }
      else
      {
        return aColour;
      }
    }
  },

  createColourArray: function ()
  {
    var colourArray = (contextHL.colourArray = new Array());
    colourArray["aliceblue"] = "240,248,255";
    colourArray["antiquewhite"] = "250,235,215";
    colourArray["aqua"] = "0,255,255";
    colourArray["aquamarine"] = "127,255,212";
    colourArray["azure"] = "240,255,255";
    colourArray["beige"] = "245,245,220";
    colourArray["bisque"] = "255,228,196";
    colourArray["black"] = "0,0,0";
    colourArray["blanchedalmond"] = "255,235,205";
    colourArray["blue"] = "0,0,255";
    colourArray["blueviolet"] = "138,43,226";
    colourArray["brown"] = "165,42,42";
    colourArray["burlywood"] = "222,184,135";
    colourArray["cadetblue"] = "95,158,160";
    colourArray["chartreuse"] = "127,255,0";
    colourArray["chocolate"] = "210,105,30";
    colourArray["coral"] = "255,127,80";
    colourArray["cornflowerblue"] = "100,149,237";
    colourArray["cornsilk"] = "255,248,220";
    colourArray["crimson"] = "220,20,60";
    colourArray["cyan"] = "0,255,255";
    colourArray["darkblue"] = "0,0,139";
    colourArray["darkcyan"] = "0,139,139";
    colourArray["darkgoldenrod"] = "184,134,11";
    colourArray["darkgray"] = "169,169,169";
    colourArray["darkgreen"] = "0,100,0";
    colourArray["darkkhaki"] = "189,183,107";
    colourArray["darkmagenta"] = "139,0,139";
    colourArray["darkolivegreen"] = "85,107,47";
    colourArray["darkorange"] = "255,140,0";
    colourArray["darkorchid"] = "153,50,204";
    colourArray["darkred"] = "139,0,0";
    colourArray["darksalmon"] = "233,150,122";
    colourArray["darkseagreen"] = "143,188,143";
    colourArray["darkslateblue"] = "72,61,139";
    colourArray["darkslategray"] = "47,79,79";
    colourArray["darkturquoise"] = "0,206,209";
    colourArray["darkviolet"] = "148,0,211";
    colourArray["deeppink"] = "255,20,147";
    colourArray["deepskyblue"] = "0,191,255";
    colourArray["dimgray"] = "105,105,105";
    colourArray["dodgerblue"] = "30,144,255";
    colourArray["firebrick"] = "178,34,34";
    colourArray["floralwhite"] = "255,250,240";
    colourArray["forestgreen"] = "34,139,34";
    colourArray["fuchsia"] = "255,0,255";
    colourArray["gainsboro"] = "220,220,220";
    colourArray["ghostwhite"] = "248,248,255";
    colourArray["gold"] = "255,215,0";
    colourArray["goldenrod"] = "218,165,32";
    colourArray["gray"] = "127,127,127";
    colourArray["grey"] = "127,127,127";
    colourArray["green"] = "0,128,0";
    colourArray["greenyellow"] = "173,255,47";
    colourArray["honeydew"] = "240,255,240";
    colourArray["hotpink"] = "255,105,180";
    colourArray["indianred"] = "205,92,92";
    colourArray["indigo"] = "75,0,130";
    colourArray["ivory"] = "255,255,240";
    colourArray["khaki"] = "240,230,140";
    colourArray["lavender"] = "230,230,250";
    colourArray["lavenderblush"] = "255,240,245";
    colourArray["lawngreen"] = "124,252,0";
    colourArray["lemonchiffon"] = "255,250,205";
    colourArray["lightblue"] = "173,216,230";
    colourArray["lightcoral"] = "240,128,128";
    colourArray["lightcyan"] = "224,255,255";
    colourArray["lightgoldenrodyellow"] = "250,250,210";
    colourArray["lightgreen"] = "144,238,144";
    colourArray["lightgrey"] = "211,211,211";
    colourArray["lightpink"] = "255,182,193";
    colourArray["lightsalmon"] = "255,160,122";
    colourArray["lightseagreen"] = "32,178,170";
    colourArray["lightskyblue"] = "135,206,250";
    colourArray["lightslategray"] = "119,136,153";
    colourArray["lightsteelblue"] = "176,196,222";
    colourArray["lightyellow"] = "255,255,224";
    colourArray["lime"] = "0,255,0";
    colourArray["limegreen"] = "50,205,50";
    colourArray["linen"] = "250,240,230";
    colourArray["magenta"] = "255,0,255";
    colourArray["maroon"] = "128,0,0";
    colourArray["mediumaquamarine"] = "102,205,170";
    colourArray["mediumblue"] = "0,0,205";
    colourArray["mediumorchid"] = "186,85,211";
    colourArray["mediumpurple"] = "147,112,219";
    colourArray["mediumseagreen"] = "60,179,113";
    colourArray["mediumslateblue"] = "123,104,238";
    colourArray["mediumspringgreen"] = "0,250,154";
    colourArray["mediumturquoise"] = "72,209,204";
    colourArray["mediumvioletred"] = "199,21,133";
    colourArray["midnightblue"] = "25,25,112";
    colourArray["mintcream"] = "245,255,250";
    colourArray["mistyrose"] = "255,228,225";
    colourArray["moccasin"] = "255,228,181";
    colourArray["navajowhite"] = "255,222,173";
    colourArray["navy"] = "0,0,128";
    colourArray["navyblue"] = "159,175,223";
    colourArray["oldlace"] = "253,245,230";
    colourArray["olive"] = "128,128,0";
    colourArray["olivedrab"] = "107,142,35";
    colourArray["orange"] = "255,165,0";
    colourArray["orangered"] = "255,69,0";
    colourArray["orchid"] = "218,112,214";
    colourArray["palegoldenrod"] = "238,232,170";
    colourArray["palegreen"] = "152,251,152";
    colourArray["paleturquoise"] = "175,238,238";
    colourArray["palevioletred"] = "219,112,147";
    colourArray["papayawhip"] = "255,239,213";
    colourArray["peachpuff"] = "255,218,185";
    colourArray["peru"] = "205,133,63";
    colourArray["pink"] = "255,192,203";
    colourArray["plum"] = "221,160,221";
    colourArray["powderblue"] = "176,224,230";
    colourArray["purple"] = "128,0,128";
    colourArray["red"] = "255,0,0";
    colourArray["rosybrown"] = "188,143,143";
    colourArray["royalblue"] = "65,105,225";
    colourArray["saddlebrown"] = "139,69,19";
    colourArray["salmon"] = "250,128,114";
    colourArray["sandybrown"] = "244,164,96";
    colourArray["seagreen"] = "46,139,87";
    colourArray["seashell"] = "255,245,238";
    colourArray["sienna"] = "160,82,45";
    colourArray["silver"] = "192,192,192";
    colourArray["skyblue"] = "135,206,235";
    colourArray["slateblue"] = "106,90,205";
    colourArray["slategray"] = "112,128,144";
    colourArray["snow"] = "255,250,250";
    colourArray["springgreen"] = "0,255,127";
    colourArray["steelblue"] = "70,130,180";
    colourArray["tan"] = "210,180,140";
    colourArray["teal"] = "0,128,128";
    colourArray["thistle"] = "216,191,216";
    colourArray["tomato"] = "255,99,71";
    colourArray["turquoise"] = "64,224,208";
    colourArray["violet"] = "238,130,238";
    colourArray["wheat"] = "245,222,179";
    colourArray["white"] = "255,255,255";
    colourArray["whitesmoke"] = "245,245,245";
    colourArray["yellow"] = "255,255,0";
    colourArray["yellowgreen"] = "139,205,50";
  },
  
  /*
    Inverts RGB value
  */
  
  getInvertColour: function (aColour)
  {
    aColour = aColour.split(",");
    for (var i = 0; i <= 2; i++)
      aColour[i] = 255 - parseFloat(aColour[i]);
    return aColour[0] + "," + aColour[1] + "," + aColour[2];
  }
    
}

window.addEventListener("load",contextHL.init,false);
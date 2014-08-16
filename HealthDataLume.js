/**
 * @file HealthDataLume.js
 * @author Shelley V. Adams 
 * @copyright 2014 Shelley V. Adams
 * @license MIT License
 * @description HealthDataLume.js requires [Bootstrap]{@link http://getbootstrap.com/} v3.x and [jQuery]{@link http://jquery.com/} v1.11 or higher.
**/

/**
 * @class HealthDataLume
 * @static
 * @description Top-level application.
 * @param {Document} doc
**/
var HealthDataLume = (function(doc) {
	/**
	 * @constant
	 * @type {String}
	 * @memberof HealthDataLume
	 * @private
	 * @description Path to default XSL.
	**/
	var XSL_FILE = "health_data_lume.xsl";

	/**
	 * @member xsltProcessor
	 * @type {XSLTProcessor}
	 * @memberof HealthDataLume
	 * @private
	**/
	var xsltProcessor = new XSLTProcessor();

	/**
	 * @member parser
	 * @type {DOMParser}
	 * @memberof HealthDataLume
	 * @private
	 * @description Used to parse XML from a String
	**/
	var parser = new DOMParser();

	/**
	 * @function errorIssueLink
	 * @memberof HealthDataLume
	 * @private
	 * @param {String} [customText]
	 * @returns {String} HTML for an anchor element
	 * @description Build a link to the project's issue page at GitHub.
	**/
	var errorIssueLink = function(customText) {
		var linkText = customText || "report an issue";
		return "<a class='alert-link' href='https://github.com/shelleyvadams/HealthDataLume/issues'>" + linkText + "</a>";
	}

	/**
	 * @function errorAlert
	 * @memberof HealthDataLume
	 * @private
	 * @param {Error} err
	 * @returns {String} HTML for a div element
	 * @description Build a Bootstrap dismissible alert (danger) containing an error message.
	**/
	var errorAlert = function(err) {
		return "<div class='alert alert-danger alert-dismissible' role='alert'>\n<button type='button' class='close' data-dismiss='alert'><span aria-hidden='true'>&times;</span><span class='sr-only'>Close</span></button>\n" +
		err +
		"\n</div>\n";
	}

	/**
	 * @function getXSL
	 * @memberof HealthDataLume
	 * @private
	 * @param {Document} loadToXmlDoc
	 * @see [Synchronous and asynchronous requests]{@link https://developer.mozilla.org/en-US/docs/Web/API/XMLHttpRequest/Synchronous_and_Asynchronous_Requests} at Mozilla Developer Network
	 * @description Load the default XSL stylesheet
	**/
	var getXSL = function(loadToXmlDoc) {

		/**
		 * @function loadXSL
		 * @memberof getXSL
		 * @private
		 * @this xhReq
		 * @param {Document} xmlDoc - Reference to an object to hold the Document object in XMLHttpRequest.responseXML
		**/
		var loadXSL = function(xmlDoc) {
			xmlDoc = this.responseXML;
			try {
				xsltProcessor.importStylesheet(xmlDoc);
			} catch (xslErr) {
				throw "<strong>Yikes!</strong> Something is wrong with the XSL stylesheet.\n" + xslErr;
			}
		}

		/**
		 * @function xhrSuccess
		 * @memberof getXSL
		 * @private
		 * @this xhReq
		 * @description Apply the callback function (loadXSL)
		**/
		var xhrSuccess = function() {
			this.callback.apply(this, this.arguments);
		}

		/**
		 * @function xhrError
		 * @memberof getXSL
		 * @private
		 * @this xhReq
		 * @throws {Error} The HTTP request should return a status of "200 OK" anything else is an error.
		**/
		var xhrError = function() {
			throw new Error( "<strong>Uh oh!</strong> Unable to load XSL formatting instructions. Try refreshing the page. If the problem persists, " + errorIssueLink() + " noting that the server said: <q>" + this.statusText + "</q>.");
		};

		var xhReq = new XMLHttpRequest();
		xhReq.callback = loadXSL;
		xhReq.arguments = arguments;
		xhReq.onload = xhrSuccess;
		xhReq.onerror = xhrError;
		xhReq.open("get", XSL_FILE, true);
		xhReq.send(null);
	}

	/**
	 * @function getFile
	 * @memberof HealthDataLume
	 * @private
	 * @param {HTMLInputElement} input - File input element
	 * @param {HTMLInputElement} display - Read-only text input element to display the name of the selected file
	 * @returns {File}
	 * @throws {Error} The selected file must have an XML media type within "text/*" or "application/*"
	 * @description Get the XML file selected by the user.
	**/
	var getFile = function(input, status) {
		var display = $("#file_path");
		display.val("");
		var userFile = input.get(0).files.item(0);
		if ( userFile.type.search(/(?:text|application)\/(?:\w[\w\.\-]+\+)?xml/) >= 0 ) {
			display.val(userFile.name);
		} else {
			throw new Error("<strong>Oops!</strong> HealthDataLume only understands XML files." + (userFile.name.length > 0 ? " If you're sure that <tt>" + userFile.name + "</tt> is an XML file, please " + errorIssueLink() + "." : ""));
		}

		var xmlReader = getXMLReader(xmlDoc, status, userFile.name);
		xmlReader.readAsText(userFile);

	};

	/**
	 * @function getXMLReader
	 * @memberof HealthDataLume
	 * @private
	 * @param {Document} targetDoc - Storage for parsed file content
	 * @param {jQuery} errContainer - Parent element for any error alerts
	 * @returns {FileReader}
	 * @throws {Error|ParserError} The selected file must be readable and contain well-formed XML.
	 * @description Setup the FileReader responsible for fetching and, through the callback function, transforming the user's XML file.
	**/
	var getXMLReader = function(targetDoc, errContainer, filename) {
		var readIt = new FileReader();
		readIt.onerror = (function() {
			return function(e) {
				throw new Error("<strong>Shoot!</strong> Couldn't load your file.");
			};
		})();
		readIt.onload = ( function(xmlDoc, container, fName) {
			return function(e) {
				try {
					xmlDoc = parser.parseFromString(e.target.result, "application/xml");
					if (xmlDoc.documentElement.tagName == "parsererror") {
						throw new ParserError(xmlDoc);
					} else {
						var outputSection = $("#output"),
							result,
							finishTime;
						try {
							result = xsltProcessor.transformToFragment(xmlDoc, doc);
						} catch (transformErr) {
							throw "<strong>Uh oh!</strong> Transformation failed.\n" + transformErr;
						}
						try {
							outputSection.removeClass("hidden").html(result);
						} catch(wtfErr) {
							throw "<strong>Boo!</strong> Something went wrong.<br/>\r" + wtfErr;
						}
						finishTime = new Date();
						outputSection.children("footer").last().append(
							"<p class=\"text-muted\">Rendered by <cite>HealthDataLume</cite> from <tt>" +
							fName +
							"</tt> at <time datetime=\"" +
							finishTime.toISOString() +
							"\">" +
							finishTime.toLocaleTimeString() +
							" on " +
							finishTime.toLocaleDateString() +
							"</time>.</p>"
						);
					}
				} catch (err) {
					container.append( errorAlert(err) );
				}
			};
		})(targetDoc, errContainer, filename);
		return readIt;
	};


	// Initialize stuff.
	$(doc).ready(function() {
		var xmlStatus = $("#xml_status");
		var fileInput = $("#xml_file");

		var xslDoc = xmlDoc = null;

		try {
			getXSL(xslDoc);
		} catch (err) {
			$("#health_data_lume").prepend( errorAlert(err) );
		}

		HelpBalloons.applyAllBalloons();
		$("#help_button").on("click", HelpBalloons.toggle);

		$("#reset_button").on("click", function(e){
			xmlStatus.empty();
			$("#output").addClass("hidden").empty();
		});

		$("#open_file").on("click", function(e) {
			fileInput.trigger("click");
		});

		fileInput.change(function(e) {
			xmlStatus.empty();
			try {
				getFile(fileInput, xmlStatus);
			} catch (err) {
				xmlStatus.append( errorAlert(err) );
			}
		});
	});

})(document);


/**
 * @class HelpBalloons
 * @static
 * @description Handles [Bootstap popovers]{@link http://getbootstrap.com/javascript/#popovers} for displaying help.
 * @todo Tenative: methods to add/destroy a help balloon.
**/
var HelpBalloons = (function() {
	/**
	 * @constant
	 * @type {String}
	 * @memberof HelpBalloons
	 * @private
	 * @description HTML class indicating an element has a popover help balloon.
	**/
	var HELP_CLASS = "popover-help";

	/**
	 * @member
	 * @type {Object}
	 * @memberof HelpBalloons
	 * @private
	 * @description Key-value pairs associating a selector (ideally an id) and an Object containing [Bootstrap popover options]{@link http://getbootstrap.com/javascript/#popovers-usage}.
	**/
	var balloons = {
		"#help_button": {
			container: "body",
			placement: "left",
			content: "Toggle help balloons.",
			trigger: "manual"
		},
		"#open_file": {
			container: "body",
			html: true,
			placement: "bottom",
			content: "Open a locally stored <abbr title='Clinical Document Architecture, Release 2'>CDA R2</abbr> or <abbr title='Consolidated Clinical Document Architecture'>C-CDA</abbr> file.",
			trigger: "manual"
		},
		"#file_path": {
			container: "body",
			html: true,
			placement: "top",
			content: "Name of current file, if any.",
			trigger: "manual"
		},
		"#samples_button": {
			container: "body",
			html: true,
			placement: "right",
			title: "Coming soon!",
			content: "Browse <a href='https://github.com/chb/sample_ccdas' target='_blank'>sample <abbr title='Consolidated Clinical Document Architecture'>C-CDA</abbr> files on GitHub</a> and select one to view with HealthDataLume.",
			trigger: "manual"
		},
		"#reset_button": {
			container: "body",
			placement: "left",
			content: "Start over. Clear file selection and any output.",
			trigger: "manual"
		},
		"#output": {
			container: "section",
			placement: "bottom",
			content: "HealthDataLume's output from the selected file.",
			trigger: "manual"
		}
	};

	/**
	 * @function applyBalloon
	 * @memberof HelpBalloons
	 * @private
	 * @static
	 * @param {String} selector
	**/
	var applyBalloon = function(selector){
		var ele = $(selector);
		ele.popover(balloons[selector]);
		ele.addClass(HELP_CLASS);
	};

	return {
	/**
	 * @function applyAllBalloons
	 * @memberof HelpBalloons
	 * @static
	**/
	applyAllBalloons: function() {
		for (var key in balloons) {
			applyBalloon(key);
		}
	},

	/**
	 * @function toggle
	 * @memberof HelpBalloons
	 * @static
	 * @param {Event} e
	**/
	toggle: function(e) {
		e.preventDefault();
		$("." + HELP_CLASS).popover("toggle");
	}

	};
})();


/** When given an invalid XML document, The {@link DOMParser} [implementation in Mozilla Gecko]{@link https://developer.mozilla.org/en-US/docs/Web/API/DOMParser#Error_handling} does not throw an {@link Error}, but returns an {@link XMLDocument} with `parsererror` as its {@link Document.documentElement}.
 * @constructor
 * @augments Error
 * @param {XMLDocument} xmlDoc - Returned by {@link DOMParser}
 * @see https://bugzilla.mozilla.org/show_bug.cgi?id=45566
**/
function ParserError(xmlDoc) {
	var serializer = new XMLSerializer();
	this.message = "<strong>Dang!</strong> Looks like that wasn't valid XML." + (xmlDoc.documentElement.textContent.length > 0 ? "\n<details class='errorDetails clearfix'>\n<summary class='pull-right'><button type='button' data-toggle='collapse' class='btn btn-default' data-target='#parsererror'>Developer details</button></summary>\n<pre id='parsererror' class='collapse'>" + serializer.serializeToString(xmlDoc) + "</pre>\n</details>\n" : "");
}

/**
 * @memberof ParserError
 * @static
**/
ParserError.name = "ParserError";
ParserError.prototype = Object.create(Error.prototype);
ParserError.prototype.constructor = ParserError;

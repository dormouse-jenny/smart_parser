﻿using System;
using System.IO;
using System.Collections.Generic;
using System.Linq;
using System.Text;
using System.Threading.Tasks;
using Microsoft.Office.Interop.Word;
using Microsoft.Win32;

namespace MicrosoftPdf2Docx
{
    class Program
    {
        public static void DeleteRegistryKey(string keyName)
        {
            using (RegistryKey key = Registry.CurrentUser.OpenSubKey(keyName, true))
            {
                if (key != null)
                {
                    foreach (var v in key.GetValueNames())
                    {
                        key.DeleteValue(v, false);
                    }
                }
            }

        }
        public static void DeleteLastCrashedDialog()
        {
            try
            {
                string wordVersion;
                Application word = new Application();
                wordVersion = word.Version;
                word.Quit();
                string keyName =
                    @"Software\Microsoft\Office\"
                    + wordVersion
                    + @"\Word\Resiliency\DisabledItems";
                DeleteRegistryKey(keyName);
            }
            catch (Exception)
            {

            }

        }
        static void ConvertFile(string inFilename, string outFileName)
        {
            Console.WriteLine(String.Format("{0} to {1}", inFilename, outFileName));
            DeleteLastCrashedDialog();
            Application word = new Application();
            var doc = word.Documents.OpenNoRepairDialog(
                Path.GetFullPath(inFilename),
                ReadOnly: true,
                ConfirmConversions: false,
                OpenAndRepair: false);
            doc.SaveAs2(Path.GetFullPath(outFileName), WdSaveFormat.wdFormatXMLDocument, CompatibilityMode: WdCompatibilityMode.wdWord2013);
            word.ActiveDocument.Close();
            word.Quit(SaveChanges: WdSaveOptions.wdDoNotSaveChanges);
        }

        static void Main(string[] args)
        {
            CMDLine.CMDLineParser parser = new CMDLine.CMDLineParser();
            CMDLine.CMDLineParser.Option skipExistsOpt = parser.AddBoolSwitch("--skip-existing", "");
            parser.AddHelpOption();
            try
            {
                parser.Parse(args);
            }
            catch (Exception ex)
            {
                //show available options      
                Console.Write(parser.HelpMessage());
                Console.WriteLine();
                Console.WriteLine("Error: " + ex.Message);
                throw;
            }
            var files = parser.RemainingArgs();
            if (files == null) {
                Console.WriteLine("no input file");
            } else
            {
                foreach (var f in files)
                {
                    string pdf = f.Trim(new char[] { '"' });
                    string winword = pdf + ".docx";
                    if (skipExistsOpt.isMatched && File.Exists(winword))
                    {
                        Console.WriteLine(string.Format("skip creating {0}", winword));
                    }
                    else
                    {
                        ConvertFile(pdf, winword);
                    }

                }
            }

        }
    }
}
